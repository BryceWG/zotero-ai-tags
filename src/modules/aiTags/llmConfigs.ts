import { getPref, setPref } from "../../utils/prefs";
import { LLMConfig } from "./types";

export interface LLMConfigState {
  configs: LLMConfig[];
  activeConfigId: string;
  activeConfig: LLMConfig;
}

const DEFAULT_CONFIG_NAME = "Default";

export function loadLLMConfigState(): LLMConfigState {
  const normalized = normalizeLLMConfigState(
    parseLLMConfigsPref(getPref("llmConfigs" as never)),
    getPref("activeLLMConfigId" as never),
  );
  persistLLMConfigState(normalized);
  return normalized;
}

export function saveLLMConfigState(
  nextState: Pick<LLMConfigState, "configs" | "activeConfigId">,
): LLMConfigState {
  const normalized = normalizeLLMConfigState(
    nextState.configs,
    nextState.activeConfigId,
  );
  persistLLMConfigState(normalized);
  return normalized;
}

export function createLLMConfig(overrides: Partial<LLMConfig> = {}) {
  return normalizeLLMConfig(
    {
      id: createLLMConfigId(),
      name: DEFAULT_CONFIG_NAME,
      apiBaseURL: "",
      apiKey: "",
      model: "",
      apiExtraParams: "",
      ...overrides,
    },
    0,
  );
}

function normalizeLLMConfigState(
  rawConfigs: unknown,
  requestedActiveConfigId: unknown,
): LLMConfigState {
  const sourceConfigs = Array.isArray(rawConfigs) ? rawConfigs : [];
  const configs = dedupeLLMConfigs(
    sourceConfigs.length ? sourceConfigs : [buildLegacyLLMConfig()],
  );
  const activeConfigId = String(requestedActiveConfigId || "").trim();
  const activeConfig =
    configs.find((config) => config.id === activeConfigId) || configs[0];

  return {
    configs,
    activeConfigId: activeConfig.id,
    activeConfig,
  };
}

function parseLLMConfigsPref(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function buildLegacyLLMConfig() {
  return createLLMConfig({
    name: DEFAULT_CONFIG_NAME,
    apiBaseURL: String(getPref("apiBaseURL") || ""),
    apiKey: String(getPref("apiKey") || ""),
    model: String(getPref("model") || ""),
    apiExtraParams: normalizeAPIExtraParamsDraft(
      getPref("apiExtraParams") || "",
    ),
  });
}

function dedupeLLMConfigs(rawConfigs: unknown[]) {
  const seenIDs = new Set<string>();
  return rawConfigs.map((rawConfig, index) => {
    const config = normalizeLLMConfig(rawConfig, index);
    if (!seenIDs.has(config.id)) {
      seenIDs.add(config.id);
      return config;
    }

    const nextConfig = {
      ...config,
      id: createLLMConfigId(),
    };
    seenIDs.add(nextConfig.id);
    return nextConfig;
  });
}

function normalizeLLMConfig(rawConfig: unknown, index: number): LLMConfig {
  const config =
    rawConfig && typeof rawConfig === "object"
      ? (rawConfig as Partial<LLMConfig>)
      : {};

  const name = String(config.name || "").trim();
  return {
    id: String(config.id || "").trim() || createLLMConfigId(),
    name: name || `Config ${index + 1}`,
    apiBaseURL: normalizeURL(config.apiBaseURL),
    apiKey: String(config.apiKey || "").trim(),
    model: String(config.model || "").trim(),
    apiExtraParams: normalizeAPIExtraParamsDraft(config.apiExtraParams),
  };
}

function normalizeURL(url: unknown) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function normalizeAPIExtraParamsDraft(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return "";
}

function persistLLMConfigState(state: LLMConfigState) {
  setPref("llmConfigs" as never, JSON.stringify(state.configs) as never);
  setPref("activeLLMConfigId" as never, state.activeConfigId as never);
  syncLegacyLLMPrefs(state.activeConfig);
}

function syncLegacyLLMPrefs(config: LLMConfig) {
  setPref("apiBaseURL", config.apiBaseURL);
  setPref("apiKey", config.apiKey);
  setPref("model", config.model);
  setPref("apiExtraParams", config.apiExtraParams);
}

function createLLMConfigId() {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `cfg_${Date.now().toString(36)}_${randomPart}`;
}
