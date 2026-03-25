import { getPref } from "../../utils/prefs";
import { TaggingPrefs } from "./types";

export const DEFAULT_USER_RULES = [
  "1. 优先生成主题、方法、研究对象和应用场景相关标签。",
  "2. 标签要短、稳定、便于后续检索。",
  "3. 避免输出过于宽泛、重复或仅改写标题的标签。",
  "4. 除非内容明确涉及，否则不要臆造领域或方法。",
].join("\n");

export function getTaggingPrefs(): TaggingPrefs {
  return {
    enable: getPref("enable"),
    apiBaseURL: normalizeURL(getPref("apiBaseURL")),
    apiKey: String(getPref("apiKey") || "").trim(),
    model: String(getPref("model") || "").trim(),
    userRules: String(getPref("userRules") || DEFAULT_USER_RULES).trim(),
    maxTags: clampNumber(getPref("maxTags"), 1, 20, 8),
    timeoutMs: clampNumber(getPref("timeoutMs"), 5000, 120000, 45000),
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
