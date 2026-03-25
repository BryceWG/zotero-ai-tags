import { config } from "../../package.json";
import { DEFAULT_USER_RULES } from "./aiTags/prefs";
import { getPref, setPref } from "../utils/prefs";

export async function registerPrefsScripts(window: Window) {
  addon.data.prefs = { window };

  setCheckboxValue(window, "enable", getPref("enable"));
  setCheckboxValue(
    window,
    "preserveExistingTags",
    getPref("preserveExistingTags"),
  );
  setCheckboxValue(
    window,
    "fallbackToAttachmentText",
    getPref("fallbackToAttachmentText"),
  );
  setCheckboxValue(window, "debug", getPref("debug"));

  setInputValue(window, "apiBaseURL", getPref("apiBaseURL"));
  setInputValue(window, "apiKey", getPref("apiKey"));
  setInputValue(window, "model", getPref("model"));
  setTextAreaValue(window, "apiExtraParams", getPref("apiExtraParams"));
  ensureNumberPref(window, "maxTags", 8, 1, 20);
  ensureNumberPref(window, "maxConcurrentRequests", 3, 1, 10);
  ensureNumberPref(window, "requestsPerSecond", 3, 1, 20);
  setTextAreaValue(
    window,
    "userRules",
    getPref("userRules") || DEFAULT_USER_RULES,
  );

  bindCheckbox(window, "enable");
  bindCheckbox(window, "preserveExistingTags");
  bindCheckbox(window, "fallbackToAttachmentText");
  bindCheckbox(window, "debug");

  bindText(window, "apiBaseURL");
  bindText(window, "apiKey");
  bindText(window, "model");
  bindTextArea(window, "apiExtraParams");
  bindNumber(window, "maxTags", 8, 1, 20);
  bindNumber(window, "maxConcurrentRequests", 3, 1, 10);
  bindNumber(window, "requestsPerSecond", 3, 1, 20);
  bindTextArea(window, "userRules");
}

function bindCheckbox(
  window: Window,
  key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
) {
  getElement<XUL.Checkbox>(window, key)?.addEventListener(
    "command",
    (event: Event) => {
      setPref(
        key,
        Boolean((event.currentTarget as XUL.Checkbox).checked) as never,
      );
    },
  );
}

function bindText(
  window: Window,
  key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
) {
  getElement<HTMLInputElement>(window, key)?.addEventListener(
    "change",
    (event: Event) => {
      setPref(
        key,
        String((event.currentTarget as HTMLInputElement).value).trim() as never,
      );
    },
  );
}

function bindTextArea(
  window: Window,
  key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
) {
  getElement<HTMLTextAreaElement>(window, key)?.addEventListener(
    "change",
    (event: Event) => {
      setPref(
        key,
        String(
          (event.currentTarget as HTMLTextAreaElement).value,
        ).trim() as never,
      );
    },
  );
}

function bindNumber(
  window: Window,
  key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
  fallback: number,
  min: number,
  max: number,
) {
  const saveDraftValue = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    if (!input.value.trim()) {
      return;
    }

    const rawValue = Number(input.value);
    if (Number.isFinite(rawValue)) {
      setPref(key, rawValue as never);
    }
  };

  const saveNormalizedValue = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const nextValue = normalizeNumberPref(input.value, fallback, min, max);
    setPref(key, nextValue as never);
    input.value = String(nextValue);
  };

  const element = getElement<HTMLInputElement>(window, key);
  element?.addEventListener("input", saveDraftValue);
  element?.addEventListener("change", saveNormalizedValue);
}

function setCheckboxValue(window: Window, key: string, value: boolean) {
  const element = getElement<XUL.Checkbox>(window, key);
  if (element) {
    element.checked = value;
  }
}

function setInputValue(window: Window, key: string, value: string) {
  const element = getElement<HTMLInputElement>(window, key);
  if (element) {
    element.value = value || "";
  }
}

function ensureNumberPref(
  window: Window,
  key: keyof _ZoteroTypes.Prefs["PluginPrefsMap"],
  fallback: number,
  min: number,
  max: number,
) {
  const value = normalizeNumberPref(getPref(key), fallback, min, max);
  setPref(key, value as never);
  setInputValue(window, key, String(value));
}

function normalizeNumberPref(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsedValue)));
}

function setTextAreaValue(window: Window, key: string, value: string) {
  const element = getElement<HTMLTextAreaElement>(window, key);
  if (element) {
    element.value = value || "";
  }
}

function getElement<T extends Element>(window: Window, key: string) {
  return window.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-${key}`,
  ) as T | null;
}
