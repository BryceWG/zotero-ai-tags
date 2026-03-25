import { CollectionRuleConfig } from "./types";

export function parseCollectionRulesPref(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) {
    return [] as CollectionRuleConfig[];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [] as CollectionRuleConfig[];
    }
    return parsed
      .map((entry) => normalizeCollectionRuleConfig(entry))
      .filter(Boolean) as CollectionRuleConfig[];
  } catch (_error) {
    return [] as CollectionRuleConfig[];
  }
}

export function serializeCollectionRulesPref(rules: CollectionRuleConfig[]) {
  if (!rules.length) {
    return "";
  }
  return JSON.stringify(rules);
}

export async function syncCollectionRuleConfig(rule: CollectionRuleConfig) {
  const collection = await resolveCollectionRuleCollection(rule);
  if (!collection) {
    return {
      ...rule,
      collectionKey: String(rule.collectionKey || "").trim(),
      collectionPath: String(rule.collectionPath || "").trim(),
      rules: String(rule.rules || "").trim(),
    } satisfies CollectionRuleConfig;
  }

  return {
    libraryID: collection.libraryID,
    collectionID: collection.id,
    collectionKey: collection.key,
    collectionPath: await buildCollectionPath(collection),
    rules: String(rule.rules || "").trim(),
  } satisfies CollectionRuleConfig;
}

export async function resolveCollectionRuleCollection(
  rule: Pick<
    CollectionRuleConfig,
    "libraryID" | "collectionID" | "collectionKey"
  >,
) {
  if (rule.collectionID && Zotero.Collections.exists(rule.collectionID)) {
    try {
      return await Zotero.Collections.getAsync(rule.collectionID);
    } catch (_error) {
      // Ignore and fall back to library/key lookup.
    }
  }

  if (rule.libraryID && rule.collectionKey) {
    return (
      (await Zotero.Collections.getByLibraryAndKeyAsync(
        rule.libraryID,
        rule.collectionKey,
        { noCache: false },
      )) || null
    );
  }

  return null;
}

export async function buildCollectionPath(collection: Zotero.Collection) {
  const names = [collection.name];
  let parentID = collection.parentID;

  while (parentID) {
    try {
      const parent = await Zotero.Collections.getAsync(parentID);
      names.unshift(parent.name);
      parentID = parent.parentID;
    } catch (_error) {
      break;
    }
  }

  return `${Zotero.Libraries.getName(collection.libraryID)} / ${names.join(" / ")}`;
}

export async function getApplicableCollectionRules(
  item: Zotero.Item,
  rules: CollectionRuleConfig[],
) {
  if (!rules.length) {
    return [] as CollectionRuleConfig[];
  }

  const collectionLineage = await getItemCollectionLineage(item);
  return rules
    .filter((rule) => rule.rules && collectionLineage.has(rule.collectionID))
    .sort((left, right) =>
      left.collectionPath.localeCompare(right.collectionPath, "zh-CN"),
    );
}

export async function detectCollectionRuleConflict(
  targetRule: Pick<
    CollectionRuleConfig,
    "libraryID" | "collectionID" | "collectionKey"
  >,
  existingRules: CollectionRuleConfig[],
) {
  const targetCollection = await resolveCollectionRuleCollection(targetRule);
  if (!targetCollection) {
    return null;
  }

  for (const existingRule of existingRules) {
    const existingCollection =
      await resolveCollectionRuleCollection(existingRule);
    if (!existingCollection) {
      continue;
    }
    if (existingCollection.libraryID !== targetCollection.libraryID) {
      continue;
    }

    if (existingCollection.id === targetCollection.id) {
      return { relation: "same", existingRule } as const;
    }

    if (await isDescendantOf(targetCollection, existingCollection.id)) {
      return { relation: "descendant", existingRule } as const;
    }

    if (await isDescendantOf(existingCollection, targetCollection.id)) {
      return { relation: "ancestor", existingRule } as const;
    }
  }

  return null;
}

async function getItemCollectionLineage(item: Zotero.Item) {
  const lineage = new Set<number>();
  for (const collectionID of item.getCollections()) {
    let currentID = collectionID;
    while (currentID && !lineage.has(currentID)) {
      lineage.add(currentID);

      try {
        const collection = await Zotero.Collections.getAsync(currentID);
        currentID = collection.parentID;
      } catch (_error) {
        break;
      }
    }
  }
  return lineage;
}

async function isDescendantOf(
  collection: Zotero.Collection,
  ancestorID: number,
) {
  let parentID = collection.parentID;
  while (parentID) {
    if (parentID === ancestorID) {
      return true;
    }

    try {
      const parent = await Zotero.Collections.getAsync(parentID);
      parentID = parent.parentID;
    } catch (_error) {
      break;
    }
  }
  return false;
}

function normalizeCollectionRuleConfig(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rule = value as Partial<CollectionRuleConfig>;
  const libraryID = toPositiveInteger(rule.libraryID);
  const collectionID = toPositiveInteger(rule.collectionID);
  if (!libraryID || !collectionID) {
    return null;
  }

  return {
    libraryID,
    collectionID,
    collectionKey: String(rule.collectionKey || "").trim(),
    collectionPath: String(rule.collectionPath || "").trim(),
    rules: String(rule.rules || "").trim(),
  } satisfies CollectionRuleConfig;
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}
