export interface TaggingPrefs {
  enable: boolean;
  autoGenerateNewItems: boolean;
  apiBaseURL: string;
  apiKey: string;
  model: string;
  apiExtraParams: Record<string, unknown>;
  userRules: string;
  collectionRules: CollectionRuleConfig[];
  maxTags: number;
  maxConcurrentRequests: number;
  requestsPerSecond: number;
  preserveExistingTags: boolean;
  fallbackToAttachmentText: boolean;
  enableCollectionRouting: boolean;
  debug: boolean;
}

export interface LLMConfig {
  id: string;
  name: string;
  apiBaseURL: string;
  apiKey: string;
  model: string;
  apiExtraParams: string;
}

export interface CollectionRuleConfig {
  libraryID: number;
  collectionID: number;
  collectionKey: string;
  collectionPath: string;
  rules: string;
}

export interface ItemOverview {
  item: Zotero.Item;
  title: string;
  abstractText: string;
  pdfFirstPageText: string;
  pdfSource: "reader-first-page" | "attachment-text-fallback" | "none";
  overviewText: string;
}

export interface BatchSummary {
  success: number;
  skipped: number;
  failed: number;
}
