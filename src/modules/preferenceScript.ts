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
  setInputValue(window, "maxTags", String(getPref("maxTags")));
  setInputValue(window, "timeoutMs", String(getPref("timeoutMs")));
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
  bindNumber(window, "maxTags", 8);
  bindNumber(window, "timeoutMs", 45000);
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
) {
  getElement<HTMLInputElement>(window, key)?.addEventListener(
    "change",
    (event: Event) => {
      const value = Number((event.currentTarget as HTMLInputElement).value);
      setPref(key, (Number.isFinite(value) ? value : fallback) as never);
    },
  );
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
