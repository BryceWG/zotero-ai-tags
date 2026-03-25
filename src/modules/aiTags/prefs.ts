import { getPref } from "../../utils/prefs";
import { parseCollectionRulesPref } from "./collectionRules";
import { loadLLMConfigState } from "./llmConfigs";
import { TaggingPrefs } from "./types";

export const DEFAULT_USER_RULES = [
  "1. 优先生成主题、方法、研究对象和应用场景相关标签。",
  "2. 标签要短、稳定、便于后续检索。",
  "3. 避免输出过于宽泛、重复或仅改写标题的标签。",
  "4. 除非内容明确涉及，否则不要臆造领域或方法。",
].join("\n");

export function getTaggingPrefs(): TaggingPrefs {
  const { activeConfig } = loadLLMConfigState();
  return {
    enable: getPref("enable"),
    apiBaseURL: normalizeURL(activeConfig.apiBaseURL),
    apiKey: String(activeConfig.apiKey || "").trim(),
    model: String(activeConfig.model || "").trim(),
    apiExtraParams: parseAPIExtraParams(activeConfig.apiExtraParams),
    userRules: String(getPref("userRules") || DEFAULT_USER_RULES).trim(),
    collectionRules: parseCollectionRulesPref(
      getPref("collectionRules" as never),
    ),
    maxTags: clampNumber(getPref("maxTags"), 1, 20, 8),
    maxConcurrentRequests: clampNumber(
      getPref("maxConcurrentRequests"),
      1,
      10,
      3,
    ),
    requestsPerSecond: clampNumber(getPref("requestsPerSecond"), 1, 20, 3),
    preserveExistingTags: getPref("preserveExistingTags"),
    fallbackToAttachmentText: getPref("fallbackToAttachmentText"),
    debug: getPref("debug"),
  };
}

export function validateTaggingPrefs(prefs: TaggingPrefs) {
  if (!prefs.enable) {
    throw new Error("error-disabled");
  }
  validateLLMRequestPrefs(prefs);
}

export function validateLLMRequestPrefs(
  prefs: Pick<TaggingPrefs, "apiBaseURL" | "apiKey" | "model">,
) {
  if (!prefs.apiBaseURL) {
    throw new Error("error-missing-api-base");
  }
  if (!prefs.apiKey) {
    throw new Error("error-missing-api-key");
  }
  if (!prefs.model) {
    throw new Error("error-missing-model");
  }
}

function clampNumber(
  value: number,
  min: number,
  max: number,
  fallback: number,
) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeURL(url: string) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function parseAPIExtraParams(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("error-invalid-api-extra-params");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "error-invalid-api-extra-params"
    ) {
      throw error;
    }
    throw new Error("error-invalid-api-extra-params");
  }
}
