pref("enable", true);
pref("apiBaseURL", "https://api.openai.com/v1");
pref("apiKey", "");
pref("model", "gpt-4.1-mini");
pref("apiExtraParams", "");
pref(
  "userRules",
  '请根据摘要内容为这篇论文打标签。优先遵守用户设置的分类规则，若无明确分类规则，优先生成主题、方法、研究对象和应用场景相关标签，并且标签要短、稳定、便于后续检索。\n仅输出标签，以JSON格式输出，例如：\n{"tags":[""]}',
);
pref("collectionRules", "");
pref("maxTags", 8);
pref("maxConcurrentRequests", 3);
pref("requestsPerSecond", 3);
pref("preserveExistingTags", true);
pref("fallbackToAttachmentText", true);
pref("debug", false);
