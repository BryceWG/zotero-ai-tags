export interface TaggingPrefs {
  enable: boolean;
  apiBaseURL: string;
  apiKey: string;
  model: string;
  apiExtraParams: Record<string, unknown>;
  userRules: string;
  maxTags: number;
  maxConcurrentRequests: number;
  requestsPerSecond: number;
  preserveExistingTags: boolean;
  fallbackToAttachmentText: boolean;
  debug: boolean;
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
