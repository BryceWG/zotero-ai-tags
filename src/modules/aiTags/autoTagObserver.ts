import { getTaggingPrefs } from "./prefs";
import { generateTagsForItems } from "./service";

const METADATA_SETTLE_DELAY_MS = 8000;
const AUTO_BATCH_DELAY_MS = 1000;
const RETIRE_TRACKING_DELAY_MS = 15000;
const AUTO_TAG_NOTIFIER_KEY = "__zoteroAITagsAutoTagWrite";

let observerID: string | null = null;
const trackedItemIDs = new Set<number>();
const settleTimers = new Map<number, ReturnType<typeof setTimeout>>();
const retireTimers = new Map<number, ReturnType<typeof setTimeout>>();
const readyItemIDs = new Set<number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;

export function registerAutoTagObserver() {
  if (observerID) {
    return;
  }

  observerID = Zotero.Notifier.registerObserver(
    { notify: handleItemNotification },
    ["item"],
    `${addon.data.config.addonRef}-auto-tag-observer`,
  );
}

export function unregisterAutoTagObserver() {
  if (observerID) {
    Zotero.Notifier.unregisterObserver(observerID);
    observerID = null;
  }
  clearObserverState();
}

async function handleItemNotification(
  event: _ZoteroTypes.Notifier.Event,
  type: _ZoteroTypes.Notifier.Type,
  ids: string[] | number[],
  extraData?: Record<string, unknown>,
) {
  if (type !== "item" || (event !== "add" && event !== "modify")) {
    return;
  }

  if (!isAutoTaggingEnabled()) {
    clearObserverState();
    return;
  }

  const itemIDs = ids
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (event === "add") {
    const items = await loadItemsByID(itemIDs);
    for (const item of items) {
      if (item.isRegularItem() && !item.isFeedItem) {
        trackedItemIDs.add(item.id);
        scheduleSettledItem(item.id);
        continue;
      }

      if (!item.parentItemID) {
        continue;
      }

      const parent = await toRegularItem(item);
      if (
        parent &&
        (trackedItemIDs.has(parent.id) ||
          readyItemIDs.has(parent.id) ||
          settleTimers.has(parent.id))
      ) {
        scheduleSettledItem(parent.id);
      }
    }
    return;
  }

  const items = await resolveRegularItemsFromIDs(itemIDs);
  for (const item of items) {
    if (hasIgnoredAutoTagModify(item.id, extraData)) {
      continue;
    }

    if (trackedItemIDs.has(item.id) || readyItemIDs.has(item.id)) {
      scheduleSettledItem(item.id);
      continue;
    }

    if (settleTimers.has(item.id)) {
      scheduleSettledItem(item.id);
    }
  }
}

function isAutoTaggingEnabled() {
  try {
    const prefs = getTaggingPrefs();
    return prefs.enable && prefs.autoGenerateNewItems;
  } catch (_error) {
    return false;
  }
}

function scheduleSettledItem(itemID: number) {
  readyItemIDs.delete(itemID);
  cancelRetireTimer(itemID);

  const existingTimer = settleTimers.get(itemID);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  settleTimers.set(
    itemID,
    setTimeout(() => {
      settleTimers.delete(itemID);
      readyItemIDs.add(itemID);
      scheduleFlush();
    }, METADATA_SETTLE_DELAY_MS),
  );
}

function scheduleFlush() {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushReadyItems();
  }, AUTO_BATCH_DELAY_MS);
}

async function flushReadyItems() {
  if (flushPromise) {
    return flushPromise;
  }

  flushPromise = (async () => {
    while (readyItemIDs.size) {
      if (!isAutoTaggingEnabled()) {
        clearObserverState();
        return;
      }

      const batchIDs = [...readyItemIDs];
      readyItemIDs.clear();

      const items = await loadItemsByID(batchIDs);
      try {
        if (items.length) {
          await generateTagsForItems(items, {
            throwOnFatalError: false,
            showProgressWindow: false,
            saveNotifierData: {
              [AUTO_TAG_NOTIFIER_KEY]: true,
            },
          });
        }
      } catch (error) {
        ztoolkit.log("auto tag generation failed", error);
      } finally {
        for (const itemID of batchIDs) {
          if (
            trackedItemIDs.has(itemID) &&
            !readyItemIDs.has(itemID) &&
            !settleTimers.has(itemID)
          ) {
            scheduleRetireTrackedItem(itemID);
          }
        }
      }
    }
  })().finally(() => {
    flushPromise = null;
    if (readyItemIDs.size && !flushTimer) {
      scheduleFlush();
    }
  });

  return flushPromise;
}

function clearObserverState() {
  for (const timer of settleTimers.values()) {
    clearTimeout(timer);
  }
  for (const timer of retireTimers.values()) {
    clearTimeout(timer);
  }

  settleTimers.clear();
  retireTimers.clear();
  trackedItemIDs.clear();
  readyItemIDs.clear();

  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

function scheduleRetireTrackedItem(itemID: number) {
  cancelRetireTimer(itemID);

  retireTimers.set(
    itemID,
    setTimeout(() => {
      retireTimers.delete(itemID);
      trackedItemIDs.delete(itemID);
      readyItemIDs.delete(itemID);

      const settleTimer = settleTimers.get(itemID);
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimers.delete(itemID);
      }
    }, RETIRE_TRACKING_DELAY_MS),
  );
}

function cancelRetireTimer(itemID: number) {
  const retireTimer = retireTimers.get(itemID);
  if (!retireTimer) {
    return;
  }

  clearTimeout(retireTimer);
  retireTimers.delete(itemID);
}

function hasIgnoredAutoTagModify(
  itemID: number,
  extraData?: Record<string, unknown>,
) {
  if (!extraData) {
    return false;
  }

  const itemExtraData = extraData[String(itemID)];
  return (
    containsAutoTagNotifierFlag(itemExtraData) ||
    containsAutoTagNotifierFlag(extraData)
  );
}

function containsAutoTagNotifierFlag(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== "object" || depth > 4) {
    return false;
  }

  if (
    Object.prototype.hasOwnProperty.call(value, AUTO_TAG_NOTIFIER_KEY) &&
    (value as Record<string, unknown>)[AUTO_TAG_NOTIFIER_KEY] === true
  ) {
    return true;
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    if (containsAutoTagNotifierFlag(nestedValue, depth + 1)) {
      return true;
    }
  }

  return false;
}

async function resolveRegularItemsFromIDs(itemIDs: number[]) {
  const items = await loadItemsByID(itemIDs);
  const regularItems = await Promise.all(
    items.map((item) => toRegularItem(item)),
  );
  const uniqueItems = new Map<number, Zotero.Item>();

  for (const item of regularItems) {
    if (item) {
      uniqueItems.set(item.id, item);
    }
  }

  return [...uniqueItems.values()];
}

async function loadItemsByID(itemIDs: number[]) {
  const uniqueIDs = [...new Set(itemIDs)];
  const items = await Promise.all(
    uniqueIDs.map(async (itemID) => {
      try {
        return await Zotero.Items.getAsync(itemID);
      } catch (_error) {
        return null;
      }
    }),
  );

  return items.filter((item): item is Zotero.Item => Boolean(item));
}

async function toRegularItem(item: Zotero.Item) {
  if (item.isRegularItem() && !item.isFeedItem) {
    return item;
  }

  if (item.parentItemID) {
    try {
      const parent = await Zotero.Items.getAsync(item.parentItemID);
      if (parent?.isRegularItem() && !parent.isFeedItem) {
        return parent;
      }
    } catch (_error) {
      return null;
    }
  }

  return null;
}
