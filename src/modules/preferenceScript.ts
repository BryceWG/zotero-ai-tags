import { config } from "../../package.json";
import { getString } from "../utils/locale";
import {
  detectCollectionRuleConflict,
  parseCollectionRulesPref,
  serializeCollectionRulesPref,
  syncCollectionRuleConfig,
} from "./aiTags/collectionRules";
import {
  createLLMConfig,
  loadLLMConfigState,
  saveLLMConfigState as persistStoredLLMConfigState,
} from "./aiTags/llmConfigs";
import { DEFAULT_USER_RULES } from "./aiTags/prefs";
import { testChatCompletionConnection } from "./aiTags/service";
import { CollectionRuleConfig, LLMConfig } from "./aiTags/types";
import { getPref, setPref } from "../utils/prefs";

interface PrefsWindowState {
  collectionRules: CollectionRuleConfig[];
  llmConfigs: LLMConfig[];
  activeLLMConfigId: string;
}

const prefsWindowState = new WeakMap<Window, PrefsWindowState>();

export async function registerPrefsScripts(window: Window) {
  addon.data.prefs = { window };
  const llmConfigState = loadLLMConfigState();
  prefsWindowState.set(window, {
    collectionRules: [],
    llmConfigs: llmConfigState.configs,
    activeLLMConfigId: llmConfigState.activeConfigId,
  });

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

  bindNumber(window, "maxTags", 8, 1, 20);
  bindNumber(window, "maxConcurrentRequests", 3, 1, 10);
  bindNumber(window, "requestsPerSecond", 3, 1, 20);
  bindTextArea(window, "userRules");
  initializeLLMConfigPrefs(window);
  bindTestAPIButton(window);
  await initializeCollectionRulePrefs(window);
}

function initializeLLMConfigPrefs(window: Window) {
  bindLLMConfigControls(window);
  renderLLMConfigSelect(window);
  syncLLMConfigForm(window);
  setLLMConfigStatus(window, "idle", "");
}

function bindLLMConfigControls(window: Window) {
  const select = getElement<HTMLSelectElement>(window, "llmConfigSelect");
  if (select) {
    select.onchange = () => {
      handleSwitchLLMConfig(window, select.value);
    };
  }

  const addButton = getElement<HTMLButtonElement>(window, "addLLMConfig");
  if (addButton) {
    addButton.onclick = () => {
      handleDuplicateLLMConfig(window);
    };
  }

  const deleteButton = getElement<HTMLButtonElement>(window, "deleteLLMConfig");
  if (deleteButton) {
    deleteButton.onclick = () => {
      handleDeleteLLMConfig(window);
    };
  }

  bindActiveLLMConfigText(window, "llmConfigName", "name");
  bindActiveLLMConfigText(window, "apiBaseURL", "apiBaseURL");
  bindActiveLLMConfigText(window, "apiKey", "apiKey");
  bindActiveLLMConfigText(window, "model", "model");
  bindActiveLLMConfigTextArea(window, "apiExtraParams", "apiExtraParams");
}

function handleSwitchLLMConfig(window: Window, nextConfigId: string) {
  syncActiveLLMConfigDraft(window);
  const state = getPrefsWindowState(window);
  state.activeLLMConfigId = nextConfigId;
  const activeConfig = persistLLMConfigPrefs(window);
  renderLLMConfigSelect(window);
  syncLLMConfigForm(window);
  setLLMConfigStatus(
    window,
    "success",
    getString("llm-config-switched" as never, {
      args: { name: activeConfig.name },
    }),
  );
}

function handleDuplicateLLMConfig(window: Window) {
  syncActiveLLMConfigDraft(window);
  const state = getPrefsWindowState(window);
  const activeConfig = getActiveLLMConfig(window);
  const newConfig = createLLMConfig({
    ...activeConfig,
    name: getNextLLMConfigName(activeConfig.name, state.llmConfigs),
  });

  state.llmConfigs = [...state.llmConfigs, newConfig];
  state.activeLLMConfigId = newConfig.id;
  persistLLMConfigPrefs(window);
  renderLLMConfigSelect(window);
  syncLLMConfigForm(window);
  setLLMConfigStatus(
    window,
    "success",
    getString("llm-config-added" as never, {
      args: { name: newConfig.name },
    }),
  );
}

function handleDeleteLLMConfig(window: Window) {
  syncActiveLLMConfigDraft(window);
  const state = getPrefsWindowState(window);
  if (state.llmConfigs.length <= 1) {
    setLLMConfigStatus(
      window,
      "error",
      getString("llm-config-minimum" as never),
    );
    return;
  }

  const activeConfig = getActiveLLMConfig(window);
  const confirmed = window.confirm(
    getString("llm-config-remove-confirm" as never, {
      args: { name: activeConfig.name },
    }),
  );
  if (!confirmed) {
    return;
  }

  const activeIndex = state.llmConfigs.findIndex(
    (config) => config.id === state.activeLLMConfigId,
  );
  state.llmConfigs = state.llmConfigs.filter(
    (config) => config.id !== state.activeLLMConfigId,
  );

  const nextIndex = Math.min(activeIndex, state.llmConfigs.length - 1);
  state.activeLLMConfigId = state.llmConfigs[Math.max(0, nextIndex)].id;
  persistLLMConfigPrefs(window);
  renderLLMConfigSelect(window);
  syncLLMConfigForm(window);
  setLLMConfigStatus(
    window,
    "success",
    getString("llm-config-removed" as never, {
      args: { name: activeConfig.name },
    }),
  );
}

function renderLLMConfigSelect(window: Window) {
  const select = getElement<HTMLSelectElement>(window, "llmConfigSelect");
  if (!select) {
    return;
  }

  const state = getPrefsWindowState(window);
  select.replaceChildren();
  for (const config of state.llmConfigs) {
    const option = window.document.createElement("option");
    option.value = config.id;
    option.textContent = config.name;
    select.appendChild(option);
  }
  select.value = state.activeLLMConfigId;

  const deleteButton = getElement<HTMLButtonElement>(window, "deleteLLMConfig");
  if (deleteButton) {
    deleteButton.disabled = state.llmConfigs.length <= 1;
  }
}

function syncLLMConfigForm(window: Window) {
  const activeConfig = getActiveLLMConfig(window);
  setInputValue(window, "llmConfigName", activeConfig.name);
  setInputValue(window, "apiBaseURL", activeConfig.apiBaseURL);
  setInputValue(window, "apiKey", activeConfig.apiKey);
  setInputValue(window, "model", activeConfig.model);
  setTextAreaValue(window, "apiExtraParams", activeConfig.apiExtraParams);
}

function syncActiveLLMConfigDraft(window: Window) {
  const state = getPrefsWindowState(window);
  const activeIndex = state.llmConfigs.findIndex(
    (config) => config.id === state.activeLLMConfigId,
  );
  if (activeIndex < 0) {
    return null;
  }

  const previousConfig = state.llmConfigs[activeIndex];
  state.llmConfigs[activeIndex] = {
    ...previousConfig,
    name:
      getInputValue(window, "llmConfigName") ||
      previousConfig.name ||
      `Config ${activeIndex + 1}`,
    apiBaseURL: getInputValue(window, "apiBaseURL"),
    apiKey: getInputValue(window, "apiKey"),
    model: getInputValue(window, "model"),
    apiExtraParams: getTextAreaValue(window, "apiExtraParams"),
  };

  const activeConfig = persistLLMConfigPrefs(window);
  if (activeConfig.name !== previousConfig.name) {
    renderLLMConfigSelect(window);
  }
  return activeConfig;
}

function persistLLMConfigPrefs(window: Window) {
  const state = getPrefsWindowState(window);
  const normalizedState = persistStoredLLMConfigState({
    configs: state.llmConfigs,
    activeConfigId: state.activeLLMConfigId,
  });
  state.llmConfigs = normalizedState.configs;
  state.activeLLMConfigId = normalizedState.activeConfigId;
  return normalizedState.activeConfig;
}

function getActiveLLMConfig(window: Window) {
  const state = getPrefsWindowState(window);
  const activeConfig = state.llmConfigs.find(
    (config) => config.id === state.activeLLMConfigId,
  );
  if (activeConfig) {
    return activeConfig;
  }
  return persistLLMConfigPrefs(window);
}

function bindActiveLLMConfigText(
  window: Window,
  elementKey: string,
  configKey: keyof LLMConfig,
) {
  getElement<HTMLInputElement>(window, elementKey)?.addEventListener(
    "change",
    (event: Event) => {
      const state = getPrefsWindowState(window);
      const activeIndex = state.llmConfigs.findIndex(
        (config) => config.id === state.activeLLMConfigId,
      );
      if (activeIndex < 0) {
        return;
      }

      state.llmConfigs[activeIndex] = {
        ...state.llmConfigs[activeIndex],
        [configKey]: String(
          (event.currentTarget as HTMLInputElement).value,
        ).trim(),
      };
      persistLLMConfigPrefs(window);
      syncLLMConfigForm(window);
      if (configKey === "name") {
        renderLLMConfigSelect(window);
      }
    },
  );
}

function bindActiveLLMConfigTextArea(
  window: Window,
  elementKey: string,
  configKey: keyof LLMConfig,
) {
  getElement<HTMLTextAreaElement>(window, elementKey)?.addEventListener(
    "change",
    (event: Event) => {
      const state = getPrefsWindowState(window);
      const activeIndex = state.llmConfigs.findIndex(
        (config) => config.id === state.activeLLMConfigId,
      );
      if (activeIndex < 0) {
        return;
      }

      state.llmConfigs[activeIndex] = {
        ...state.llmConfigs[activeIndex],
        [configKey]: String(
          (event.currentTarget as HTMLTextAreaElement).value,
        ).trim(),
      };
      persistLLMConfigPrefs(window);
      syncLLMConfigForm(window);
    },
  );
}

function getNextLLMConfigName(baseName: string, configs: LLMConfig[]) {
  const trimmedBaseName = baseName.trim() || "Config";
  const existingNames = new Set(
    configs.map((config) => config.name.trim().toLocaleLowerCase()),
  );

  if (!existingNames.has(trimmedBaseName.toLocaleLowerCase())) {
    return trimmedBaseName;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${trimmedBaseName} ${index}`;
    if (!existingNames.has(candidate.toLocaleLowerCase())) {
      return candidate;
    }
  }

  return `${trimmedBaseName} ${Date.now()}`;
}

function bindTestAPIButton(window: Window) {
  setTestAPIStatus(window, "idle", "");
  getElement<HTMLButtonElement>(window, "testAPIConnection")?.addEventListener(
    "click",
    async (event: Event) => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      syncActiveLLMConfigDraft(window);
      setTestAPIStatus(window, "pending", getString("api-test-start" as never));

      try {
        await testChatCompletionConnection();
        setTestAPIStatus(
          window,
          "success",
          getString("api-test-success" as never),
        );
      } catch (error) {
        setTestAPIStatus(
          window,
          "error",
          getString("api-test-failure" as never, {
            args: { message: getLocalizedErrorMessage(error) },
          }),
        );
      } finally {
        button.disabled = false;
      }
    },
  );
}

async function initializeCollectionRulePrefs(window: Window) {
  const collectionRules = await loadCollectionRules();
  getPrefsWindowState(window).collectionRules = collectionRules;

  bindCollectionRuleControls(window);
  setCollectionRulesStatus(window, "idle", "");
  await populateCollectionRuleSelect(window);
  renderCollectionRuleList(window);
  persistCollectionRules(window);
}

function bindCollectionRuleControls(window: Window) {
  const select = getElement<HTMLSelectElement>(
    window,
    "collectionRuleCollection",
  );
  if (select) {
    select.onchange = () => {
      toggleCollectionRuleAddButton(window);
      setCollectionRulesStatus(window, "idle", "");
    };
  }

  const button = getElement<HTMLButtonElement>(window, "addCollectionRule");
  if (button) {
    button.onclick = () => {
      void handleAddCollectionRule(window);
    };
  }
}

async function handleAddCollectionRule(window: Window) {
  const select = getElement<HTMLSelectElement>(
    window,
    "collectionRuleCollection",
  );
  const option = select?.selectedOptions?.[0] as HTMLOptionElement | undefined;
  if (!option?.value) {
    setCollectionRulesStatus(
      window,
      "error",
      getString("collection-rule-select-required" as never),
    );
    return;
  }

  const candidate = {
    libraryID: Number(option.dataset.libraryId || 0),
    collectionID: Number(option.value),
    collectionKey: String(option.dataset.collectionKey || ""),
    collectionPath: String(
      option.dataset.collectionPath || option.textContent || "",
    ),
    rules: "",
  } satisfies CollectionRuleConfig;

  const state = getPrefsWindowState(window);
  const conflict = await detectCollectionRuleConflict(
    candidate,
    state.collectionRules,
  );
  if (conflict) {
    setCollectionRulesStatus(
      window,
      "error",
      getCollectionRuleConflictMessage(
        conflict.relation,
        conflict.existingRule,
      ),
    );
    return;
  }

  const newRule = await syncCollectionRuleConfig(candidate);
  state.collectionRules = sortCollectionRules([
    ...state.collectionRules,
    newRule,
  ]);
  persistCollectionRules(window);
  renderCollectionRuleList(window);

  if (select) {
    select.value = "";
  }
  toggleCollectionRuleAddButton(window);
  setCollectionRulesStatus(
    window,
    "success",
    getString("collection-rule-added" as never, {
      args: { path: newRule.collectionPath },
    }),
  );
}

async function loadCollectionRules() {
  const parsed = parseCollectionRulesPref(getPref("collectionRules" as never));
  const synced = await Promise.all(
    parsed.map((rule) => syncCollectionRuleConfig(rule)),
  );
  return dedupeCollectionRules(synced);
}

function renderCollectionRuleList(window: Window) {
  const container = getElement<HTMLDivElement>(window, "collectionRulesList");
  if (!container) {
    return;
  }

  container.replaceChildren();
  const state = getPrefsWindowState(window);
  if (!state.collectionRules.length) {
    const empty = window.document.createElement("div");
    empty.className = `${config.addonRef}-prefs-collection-empty`;
    empty.textContent = getString("collection-rule-empty" as never);
    container.appendChild(empty);
    return;
  }

  state.collectionRules.forEach((rule, index) => {
    const item = window.document.createElement("div");
    item.className = `${config.addonRef}-prefs-collection-item`;

    const header = window.document.createElement("div");
    header.className = `${config.addonRef}-prefs-collection-item-header`;

    const title = window.document.createElement("div");
    title.className = `${config.addonRef}-prefs-collection-item-title`;
    title.textContent =
      rule.collectionPath || getString("collection-rule-unknown" as never);

    const removeButton = window.document.createElement("button");
    removeButton.type = "button";
    removeButton.className = `${config.addonRef}-prefs-secondary-button`;
    removeButton.textContent = getString("collection-rule-remove" as never);
    removeButton.onclick = () => {
      removeCollectionRule(window, index);
    };

    header.append(title, removeButton);

    const note = window.document.createElement("div");
    note.className = `${config.addonRef}-prefs-help`;
    note.textContent = isMissingCollectionRule(rule)
      ? getString("collection-rule-missing" as never)
      : getString("collection-rule-applies" as never);

    const textarea = window.document.createElement("textarea");
    textarea.value = rule.rules;
    textarea.placeholder = getString("collection-rule-placeholder" as never);
    textarea.oninput = (event: Event) => {
      updateCollectionRuleText(
        window,
        index,
        (event.currentTarget as HTMLTextAreaElement).value,
      );
    };
    textarea.onchange = (event: Event) => {
      const input = event.currentTarget as HTMLTextAreaElement;
      input.value = input.value.trim();
      updateCollectionRuleText(window, index, input.value);
    };

    item.append(header, note, textarea);
    container.appendChild(item);
  });
}

function updateCollectionRuleText(
  window: Window,
  index: number,
  value: string,
) {
  const state = getPrefsWindowState(window);
  const currentRule = state.collectionRules[index];
  if (!currentRule) {
    return;
  }

  state.collectionRules[index] = {
    ...currentRule,
    rules: value,
  };
  persistCollectionRules(window);
}

function removeCollectionRule(window: Window, index: number) {
  const state = getPrefsWindowState(window);
  const currentRule = state.collectionRules[index];
  if (!currentRule) {
    return;
  }

  state.collectionRules = state.collectionRules.filter(
    (_, itemIndex) => itemIndex !== index,
  );
  persistCollectionRules(window);
  renderCollectionRuleList(window);
  setCollectionRulesStatus(
    window,
    "success",
    getString("collection-rule-removed" as never, {
      args: {
        path:
          currentRule.collectionPath ||
          getString("collection-rule-unknown" as never),
      },
    }),
  );
}

async function populateCollectionRuleSelect(window: Window) {
  const select = getElement<HTMLSelectElement>(
    window,
    "collectionRuleCollection",
  );
  if (!select) {
    return;
  }

  const previousValue = select.value;
  select.replaceChildren();

  const placeholderOption = window.document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = getString(
    "collection-rule-select-placeholder" as never,
  );
  select.appendChild(placeholderOption);

  const libraries = Zotero.Libraries.getAll().filter(
    (library) => library.libraryType !== "feed",
  );
  for (const library of libraries) {
    await library.waitForDataLoad("collection");
    const rootCollections = sortCollectionsByName(
      Zotero.Collections.getByLibrary(library.libraryID),
    );
    if (!rootCollections.length) {
      continue;
    }

    const group = window.document.createElement("optgroup");
    group.label = library.name;
    for (const collection of rootCollections) {
      appendCollectionOption(window, group, library.name, collection);
    }
    select.appendChild(group);
  }

  select.value = select.querySelector(`option[value="${previousValue}"]`)
    ? previousValue
    : "";
  toggleCollectionRuleAddButton(window);
}

function appendCollectionOption(
  window: Window,
  container: HTMLOptGroupElement,
  libraryName: string,
  collection: Zotero.Collection,
  parentPath = "",
) {
  const currentPath = parentPath
    ? `${parentPath} / ${collection.name}`
    : collection.name;

  const option = window.document.createElement("option");
  option.value = String(collection.id);
  option.textContent = currentPath;
  option.dataset.libraryId = String(collection.libraryID);
  option.dataset.collectionKey = collection.key;
  option.dataset.collectionPath = `${libraryName} / ${currentPath}`;
  container.appendChild(option);

  const childCollections = sortCollectionsByName(
    collection.getChildCollections(),
  );
  for (const childCollection of childCollections) {
    appendCollectionOption(
      window,
      container,
      libraryName,
      childCollection,
      currentPath,
    );
  }
}

function toggleCollectionRuleAddButton(window: Window) {
  const select = getElement<HTMLSelectElement>(
    window,
    "collectionRuleCollection",
  );
  const button = getElement<HTMLButtonElement>(window, "addCollectionRule");
  if (!button) {
    return;
  }

  button.disabled = !select?.value;
}

function persistCollectionRules(window: Window) {
  const state = getPrefsWindowState(window);
  setPref(
    "collectionRules" as never,
    serializeCollectionRulesPref(state.collectionRules) as never,
  );
}

function getPrefsWindowState(window: Window) {
  const state = prefsWindowState.get(window);
  if (!state) {
    throw new Error("Preference state is not initialized");
  }
  return state;
}

function dedupeCollectionRules(rules: CollectionRuleConfig[]) {
  const uniqueRules = new Map<string, CollectionRuleConfig>();
  for (const rule of rules) {
    uniqueRules.set(getCollectionRuleIdentity(rule), rule);
  }
  return sortCollectionRules([...uniqueRules.values()]);
}

function sortCollectionRules(rules: CollectionRuleConfig[]) {
  return [...rules].sort((left, right) => {
    const leftPath =
      left.collectionPath || `${left.libraryID}:${left.collectionID}`;
    const rightPath =
      right.collectionPath || `${right.libraryID}:${right.collectionID}`;
    return leftPath.localeCompare(rightPath, "zh-CN");
  });
}

function sortCollectionsByName(collections: Zotero.Collection[]) {
  return [...collections].sort((left, right) =>
    left.name.localeCompare(right.name, "zh-CN"),
  );
}

function getCollectionRuleIdentity(rule: CollectionRuleConfig) {
  return `${rule.libraryID}:${rule.collectionID}`;
}

function isMissingCollectionRule(rule: CollectionRuleConfig) {
  if (Zotero.Collections.exists(rule.collectionID)) {
    return false;
  }

  if (rule.collectionKey) {
    return !Zotero.Collections.getIDFromLibraryAndKey(
      rule.libraryID,
      rule.collectionKey,
    );
  }

  return true;
}

function getCollectionRuleConflictMessage(
  relation: "same" | "ancestor" | "descendant",
  existingRule: CollectionRuleConfig,
) {
  const args = {
    path:
      existingRule.collectionPath ||
      getString("collection-rule-unknown" as never),
  };

  if (relation === "same") {
    return getString("collection-rule-conflict-same" as never, { args });
  }
  if (relation === "descendant") {
    return getString("collection-rule-conflict-descendant" as never, { args });
  }
  return getString("collection-rule-conflict-ancestor" as never, { args });
}

function setTestAPIStatus(
  window: Window,
  state: "idle" | "pending" | "success" | "error",
  message: string,
) {
  const element = getElement<HTMLSpanElement>(
    window,
    "testAPIConnectionStatus",
  );
  setStatusElementState(element, state, message);
}

function setCollectionRulesStatus(
  window: Window,
  state: "idle" | "success" | "error",
  message: string,
) {
  const element = getElement<HTMLSpanElement>(window, "collectionRulesStatus");
  setStatusElementState(element, state, message);
}

function setLLMConfigStatus(
  window: Window,
  state: "idle" | "success" | "error",
  message: string,
) {
  const element = getElement<HTMLSpanElement>(window, "llmConfigStatus");
  setStatusElementState(element, state, message);
}

function setStatusElementState(
  element: HTMLSpanElement | null,
  state: "idle" | "pending" | "success" | "error",
  message: string,
) {
  if (!element) {
    return;
  }
  if (state === "idle") {
    element.removeAttribute("data-state");
  } else {
    element.dataset.state = state;
  }
  element.textContent = message;
}

function getLocalizedErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    if (/^error-/.test(error.message)) {
      return getString(error.message as never);
    }
    return error.message;
  }
  return String(error);
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

function getInputValue(window: Window, key: string) {
  return String(getElement<HTMLInputElement>(window, key)?.value || "").trim();
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

function getTextAreaValue(window: Window, key: string) {
  return String(
    getElement<HTMLTextAreaElement>(window, key)?.value || "",
  ).trim();
}

function getElement<T extends Element>(window: Window, key: string) {
  return window.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-${key}`,
  ) as T | null;
}
