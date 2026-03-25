import { registerAITagsMenu } from "./modules/aiTags/command";
import {
  generateTagsForItem,
  generateTagsForItems,
  generateTagsForSelection,
} from "./modules/aiTags/service";
import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  registerPrefsPane();
  addon.api = {
    generateTagsForItem,
    generateTagsForItems,
    generateTagsForSelection,
  };

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  addon.data.ztoolkit = createZToolkit();
  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );
  registerAITagsMenu(win);
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  return;
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  delete (Zotero as Record<string, unknown>)[addon.data.config.addonInstance];
}

async function onPrefsEvent(type: string, data: Record<string, unknown>) {
  switch (type) {
    case "load":
      await registerPrefsScripts(data.window as Window);
      break;
    default:
      return;
  }
}

function registerPrefsPane() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};
