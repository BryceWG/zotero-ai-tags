import { assert } from "chai";
import { config } from "../package.json";

describe("startup", function () {
  it("should have plugin instance defined", function () {
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });

  it("should expose ai tag command", function () {
    assert.isFunction(
      (Zotero[config.addonInstance] as any).api.generateTagsForSelection,
    );
    assert.isFunction(
      (Zotero[config.addonInstance] as any).api.generateTagsForItem,
    );
    assert.isFunction(
      (Zotero[config.addonInstance] as any).api.generateTagsForItems,
    );
  });
});
