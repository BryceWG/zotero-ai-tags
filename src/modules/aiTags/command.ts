import { getString } from "../../utils/locale";
import { generateTagsForSelection } from "./service";

export function registerAITagsMenu(_win: _ZoteroTypes.MainWindow) {
  const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;

  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: `zotero-itemmenu-${addon.data.config.addonRef}-generate-tags`,
    label: getString("menu-generate-tags"),
    commandListener: () => {
      void generateTagsForSelection();
    },
    icon: menuIcon,
  });
}
