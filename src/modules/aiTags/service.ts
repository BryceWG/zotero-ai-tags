import { getString } from "../../utils/locale";
import { getTaggingPrefs, validateTaggingPrefs } from "./prefs";
import { RequestLimiter } from "./requestLimiter";
import { BatchSummary, ItemOverview, TaggingPrefs } from "./types";

const MAX_ABSTRACT_CHARS = 4000;
const MAX_PDF_CHARS = 6000;
const MAX_REQUEST_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;

interface ProgressState {
  queued: number;
  requesting: number;
  completed: number;
  total: number;
}

class LLMRequestError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LLMRequestError";
  }
}

export async function generateTagsForSelection() {
  const progress = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("progress-start"),
      type: "default",
      progress: 0,
    })
    .show();

  try {
    const prefs = getTaggingPrefs();
    validateTaggingPrefs(prefs);

    const items = await getSelectedRegularItems();
    if (!items.length) {
      throw new Error("error-no-selection");
    }

    const requestLimiter = new RequestLimiter(
      prefs.maxConcurrentRequests,
      prefs.requestsPerSecond,
    );

    const summary: BatchSummary = {
      success: 0,
      skipped: 0,
      failed: 0,
    };

    const progressState: ProgressState = {
      queued: 0,
      requesting: 0,
      completed: 0,
      total: items.length,
    };

    updateProgressStatus(
      progress,
      "progress-queue-empty",
      prefs,
      progressState,
    );

    await runWithConcurrency(
      items,
      prefs.maxConcurrentRequests,
      async (item, index) => {
        const title =
          item.getDisplayTitle() || item.getField("title") || item.key;

        try {
          const overview = await buildItemOverview(item, prefs);
          if (!overview.overviewText) {
            summary.skipped += 1;
            debugLog(prefs, "skip empty overview", item.id);
            return;
          }

          progressState.queued += 1;
          updateProgressStatus(
            progress,
            "progress-item-queued",
            prefs,
            progressState,
            title,
            index + 1,
          );

          const raw = await requestLimiter.run(async () => {
            progressState.queued = Math.max(0, progressState.queued - 1);
            progressState.requesting += 1;
            updateProgressStatus(
              progress,
              "progress-item-requesting",
              prefs,
              progressState,
              title,
              index + 1,
            );

            try {
              return await requestTags(overview, prefs);
            } finally {
              progressState.requesting = Math.max(
                0,
                progressState.requesting - 1,
              );
            }
          });

          const tags = parseTags(raw, prefs.maxTags);
          if (!tags.length) {
            summary.skipped += 1;
            debugLog(prefs, "skip empty tags", item.id, raw);
            return;
          }

          const addedCount = await writeTagsToItem(item, tags, prefs);
          if (addedCount > 0 || !prefs.preserveExistingTags) {
            summary.success += 1;
          } else {
            summary.skipped += 1;
          }
        } catch (error) {
          summary.failed += 1;
          debugLog(prefs, "tag generation failed", item.id, error);
        } finally {
          progressState.completed += 1;
          updateProgressStatus(
            progress,
            "progress-item-completed",
            prefs,
            progressState,
            title,
            index + 1,
          );
        }
      },
    );

    progress.changeLine({
      text: getString("progress-summary", {
        args: {
          success: summary.success,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      }),
      type: summary.failed > 0 ? "warning" : "success",
      progress: 100,
    });
    progress.startCloseTimer(8000);
  } catch (error) {
    progress.changeLine({
      text: getString("progress-failure", {
        args: {
          message: getErrorMessage(error),
        },
      }),
      type: "error",
      progress: 100,
    });
    progress.startCloseTimer(10000);
  }
}

async function getSelectedRegularItems() {
  const selectedItems = ztoolkit
    .getGlobal("ZoteroPane")
    .getSelectedItems() as Zotero.Item[];
  const mappedItems = await Promise.all(
    selectedItems.map(async (item) => {
      if (item.isRegularItem() && !item.isFeedItem) {
        return item;
      }
      if (item.parentItemID) {
        const parent = await Zotero.Items.getAsync(item.parentItemID);
        if (parent?.isRegularItem() && !parent.isFeedItem) {
          return parent;
        }
      }
      return null;
    }),
  );

  const uniqueItems = new Map<number, Zotero.Item>();
  for (const item of mappedItems) {
    if (item) {
      uniqueItems.set(item.id, item);
    }
  }
  return [...uniqueItems.values()];
}

async function buildItemOverview(item: Zotero.Item, prefs: TaggingPrefs) {
  const title = cleanText(
    String(item.getField("title") || item.getDisplayTitle() || ""),
  );
  const abstractText = limitText(
    cleanText(String(item.getField("abstractNote") || "")),
    MAX_ABSTRACT_CHARS,
  );

  let pdfFirstPageText = "";
  let pdfSource: ItemOverview["pdfSource"] = "none";
  const pdfAttachment = await getBestPDFAttachment(item);
  if (pdfAttachment) {
    const extracted = await extractPdfFirstPageText(pdfAttachment, prefs);
    pdfFirstPageText = extracted.text;
    pdfSource = extracted.source;
  }

  const parts = [
    title ? `标题：${title}` : "",
    abstractText ? `摘要：\n${abstractText}` : "",
    pdfFirstPageText ? `PDF 第 1 页：\n${pdfFirstPageText}` : "",
  ].filter(Boolean);

  return {
    item,
    title,
    abstractText,
    pdfFirstPageText,
    pdfSource,
    overviewText: parts.join("\n\n"),
  } satisfies ItemOverview;
}

async function getBestPDFAttachment(item: Zotero.Item) {
  if (item.isPDFAttachment()) {
    return item;
  }

  const bestAttachment = await item.getBestAttachment();
  if (bestAttachment && bestAttachment.isPDFAttachment()) {
    return bestAttachment;
  }

  const attachments = await item.getBestAttachments();
  return attachments.find((attachment) => attachment.isPDFAttachment()) || null;
}

async function extractPdfFirstPageText(
  attachment: Zotero.Item,
  prefs: TaggingPrefs,
) {
  try {
    const text = await extractPdfFirstPageTextWithReader(attachment);
    if (text) {
      return {
        text: limitText(text, MAX_PDF_CHARS),
        source: "reader-first-page" as const,
      };
    }
  } catch (error) {
    debugLog(prefs, "reader extraction failed", attachment.id, error);
  }

  if (!prefs.fallbackToAttachmentText) {
    return { text: "", source: "none" as const };
  }

  try {
    const fullText = cleanText(await attachment.attachmentText);
    return {
      text: limitText(fullText, MAX_PDF_CHARS),
      source: fullText
        ? ("attachment-text-fallback" as const)
        : ("none" as const),
    };
  } catch (error) {
    debugLog(prefs, "attachment text fallback failed", attachment.id, error);
    return { text: "", source: "none" as const };
  }
}

async function extractPdfFirstPageTextWithReader(attachment: Zotero.Item) {
  let reader = getExistingReader(attachment.id);
  let shouldCloseReader = false;

  if (!reader) {
    const openedReader = await Zotero.Reader.open(
      attachment.id,
      { pageIndex: 0 },
      { openInBackground: true, allowDuplicate: false },
    );
    reader =
      (openedReader as _ZoteroTypes.ReaderInstance<"pdf"> | undefined) ||
      getExistingReader(attachment.id);
    shouldCloseReader = Boolean(openedReader);
  }

  if (!reader) {
    throw new Error("无法打开 PDF 阅读器");
  }

  try {
    const iframeWindow = await waitForReaderWindow(reader);
    const app = await waitForPDFViewerApplication(iframeWindow);
    const page = await app.pdfDocument.getPage(1);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as Array<{ str?: string }>)
      .map((entry) => entry.str || "")
      .join(" ");
    return cleanText(pageText);
  } finally {
    const closableReader = reader as
      | _ZoteroTypes.ReaderTab
      | _ZoteroTypes.ReaderWindow;
    if (shouldCloseReader && "close" in closableReader) {
      closableReader.close();
    }
  }
}

function getExistingReader(itemID: number) {
  return (
    Zotero.Reader._readers?.find(
      (reader: _ZoteroTypes.ReaderInstance) => reader.itemID === itemID,
    ) || null
  );
}

async function waitForReaderWindow(reader: _ZoteroTypes.ReaderInstance) {
  for (let index = 0; index < 40; index += 1) {
    const iframe = reader._iframeWindow as Window & {
      wrappedJSObject?: Window;
    };
    const iframeWindow = iframe?.wrappedJSObject || reader._iframeWindow;
    if (iframeWindow) {
      return iframeWindow as Window & {
        PDFViewerApplication?: _ZoteroTypes.Reader.PDFViewerApplication;
      };
    }
    await Zotero.Promise.delay(150);
  }
  throw new Error("PDF 阅读器初始化超时");
}

async function waitForPDFViewerApplication(
  iframeWindow: Window & {
    PDFViewerApplication?: _ZoteroTypes.Reader.PDFViewerApplication;
  },
) {
  for (let index = 0; index < 40; index += 1) {
    const app = iframeWindow.PDFViewerApplication;
    if (app?.initializedPromise) {
      await app.initializedPromise;
    }
    if (app?.pdfDocument) {
      return app as _ZoteroTypes.Reader.PDFViewerApplication & {
        pdfDocument: _ZoteroTypes.Reader.PDFDocumentProxy;
      };
    }
    await Zotero.Promise.delay(150);
  }
  throw new Error("PDF 文档尚未就绪");
}

async function requestTags(overview: ItemOverview, prefs: TaggingPrefs) {
  const messages = buildMessages(overview, prefs);
  const response = await requestChatCompletionWithRetry(messages, prefs);
  const payload = JSON.parse(response.responseText || "{}");
  const content =
    payload?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.text;

  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map(
        (entry: { text?: string; type?: string }) =>
          entry.text || entry.type || "",
      )
      .join("\n");
  }

  throw new Error("LLM 返回内容不可解析");
}

async function requestChatCompletionWithRetry(
  messages: Array<{ role: "system" | "user"; content: string }>,
  prefs: TaggingPrefs,
) {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_REQUEST_ATTEMPTS) {
    attempt += 1;

    try {
      return await performChatCompletionRequest(messages, prefs);
    } catch (error) {
      const normalizedError = normalizeRequestError(error);
      lastError = normalizedError;

      if (!normalizedError.retryable || attempt >= MAX_REQUEST_ATTEMPTS) {
        throw normalizedError;
      }

      const delayMs = getRetryDelayMs(normalizedError, attempt);
      debugLog(
        prefs,
        `llm request retry ${attempt}/${MAX_REQUEST_ATTEMPTS}`,
        normalizedError.message,
        `delay=${delayMs}ms`,
      );
      await Zotero.Promise.delay(delayMs);
    }
  }

  throw normalizeRequestError(lastError);
}

async function performChatCompletionRequest(
  messages: Array<{ role: "system" | "user"; content: string }>,
  prefs: TaggingPrefs,
) {
  const response = await Zotero.HTTP.request(
    "POST",
    `${prefs.apiBaseURL}/chat/completions`,
    {
      body: JSON.stringify({
        model: prefs.model,
        messages,
        temperature: 0.2,
      }),
      headers: {
        Authorization: `Bearer ${prefs.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: prefs.timeoutMs,
      successCodes: false,
      errorDelayIntervals: [],
      errorDelayMax: 0,
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new LLMRequestError(
      "LLM 认证失败，请检查 API Key",
      false,
      response.status,
    );
  }
  if (response.status === 429) {
    throw new LLMRequestError(
      "LLM 请求过于频繁，请稍后再试",
      true,
      response.status,
      parseRetryAfterMs(response),
    );
  }
  if (response.status === 408 || response.status >= 500) {
    throw new LLMRequestError(
      `LLM 服务暂时不可用，状态码 ${response.status}`,
      true,
      response.status,
      parseRetryAfterMs(response),
    );
  }
  if (response.status < 200 || response.status >= 300) {
    throw new LLMRequestError(
      `LLM 请求失败，状态码 ${response.status}`,
      false,
      response.status,
    );
  }

  return response;
}

function buildMessages(overview: ItemOverview, prefs: TaggingPrefs) {
  return [
    {
      role: "system",
      content: [
        "你是 Zotero 文献标签助手。",
        "请根据用户规则和文献概览生成标签。",
        `最多返回 ${prefs.maxTags} 个标签。`,
        '只返回 JSON，格式必须为 {"tags":["标签1","标签2"]}。',
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `用户规则：\n${prefs.userRules || "无额外规则"}`,
        `文献概览：\n${overview.overviewText}`,
        "请输出适合写入 Zotero 标签栏的中文或英文短标签，避免重复、空值和完整句子。",
      ].join("\n\n"),
    },
  ] satisfies Array<{ role: "system" | "user"; content: string }>;
}

function parseTags(raw: string, maxTags: number) {
  const parsed = parseJSONBlock(raw);
  const candidateTags = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.tags)
      ? parsed.tags
      : [];

  const uniqueTags = new Map<string, string>();
  for (const candidate of candidateTags) {
    const normalized = normalizeTag(candidate);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLocaleLowerCase();
    if (!uniqueTags.has(key)) {
      uniqueTags.set(key, normalized);
    }
    if (uniqueTags.size >= maxTags) {
      break;
    }
  }
  return [...uniqueTags.values()];
}

function parseJSONBlock(raw: string) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) {
      throw new Error("LLM 未返回 JSON");
    }
    return JSON.parse(match[0]);
  }
}

async function writeTagsToItem(
  item: Zotero.Item,
  tags: string[],
  prefs: TaggingPrefs,
) {
  if (!item.isEditable("edit")) {
    throw new Error("当前条目不可编辑");
  }

  if (!prefs.preserveExistingTags) {
    item.removeAllTags();
  }

  const existingTags = new Set(
    item
      .getTags()
      .map((entry) => normalizeTag(entry.tag).toLocaleLowerCase())
      .filter(Boolean),
  );

  let addedCount = 0;
  for (const tag of tags) {
    const key = tag.toLocaleLowerCase();
    if (existingTags.has(key)) {
      continue;
    }
    if (item.addTag(tag, 0)) {
      existingTags.add(key);
      addedCount += 1;
    }
  }

  if (addedCount > 0 || !prefs.preserveExistingTags) {
    await item.saveTx();
  }
  return addedCount;
}

function cleanText(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .split("\u0000")
    .join("")
    .trim();
}

function limitText(text: string, maxChars: number) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars).trim()}...`;
}

function normalizeTag(candidate: unknown) {
  if (typeof candidate !== "string") {
    return "";
  }
  const normalized = candidate.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (
    !normalized ||
    normalized.length > 60 ||
    /^[\p{P}\p{S}\s]+$/u.test(normalized)
  ) {
    return "";
  }
  return normalized;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    if (/^error-/.test(error.message)) {
      return getString(error.message as never);
    }
    return error.message;
  }
  return String(error || "未知错误");
}

function updateProgressStatus(
  progress: { changeLine: (options: Record<string, unknown>) => void },
  key:
    | "progress-queue-empty"
    | "progress-item-queued"
    | "progress-item-requesting"
    | "progress-item-completed",
  prefs: TaggingPrefs,
  state: ProgressState,
  title = "-",
  current = state.completed,
) {
  progress.changeLine({
    text: getString(key, {
      args: {
        current,
        total: state.total,
        title,
        queued: state.queued,
        requesting: state.requesting,
        completed: state.completed,
        concurrency: prefs.maxConcurrentRequests,
        rps: prefs.requestsPerSecond,
      },
    }),
    progress: Math.round((state.completed / state.total) * 100),
  });
}

function normalizeRequestError(error: unknown) {
  if (error instanceof LLMRequestError) {
    return error;
  }

  const message =
    error instanceof Error ? error.message : String(error || "未知错误");
  const retryable = /timeout|timed out|network|offline|ns_error|temporar/i.test(
    message.toLowerCase(),
  );

  return new LLMRequestError(message, retryable);
}

function getRetryDelayMs(error: LLMRequestError, attempt: number) {
  const jitterMs = Math.floor(Math.random() * 250);
  if (error.retryAfterMs && error.retryAfterMs > 0) {
    return error.retryAfterMs + jitterMs;
  }
  return BASE_RETRY_DELAY_MS * 2 ** (attempt - 1) + jitterMs;
}

function parseRetryAfterMs(response: XMLHttpRequest) {
  const retryAfter = response.getResponseHeader("Retry-After");
  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(retryAfter);
  if (Number.isNaN(dateMs)) {
    return undefined;
  }

  return Math.max(0, dateMs - Date.now());
}

function debugLog(prefs: TaggingPrefs, ...args: unknown[]) {
  if (prefs.debug || addon.data.env === "development") {
    ztoolkit.log(...args);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<void>,
) {
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await handler(items[currentIndex], currentIndex);
      }
    }),
  );
}
