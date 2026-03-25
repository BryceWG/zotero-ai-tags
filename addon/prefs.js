pref("enable", true);
pref("apiBaseURL", "https://api.openai.com/v1");
pref("apiKey", "");
pref("model", "gpt-4.1-mini");
pref(
  "userRules",
  "1. 优先生成主题、方法、研究对象和应用场景相关标签。\n2. 标签要短、稳定、便于后续检索。\n3. 避免输出过于宽泛、重复或仅改写标题的标签。\n4. 除非内容明确涉及，否则不要臆造领域或方法。",
);
pref("maxTags", 8);
pref("timeoutMs", 45000);
pref("maxConcurrentRequests", 3);
pref("requestsPerSecond", 3);
pref("preserveExistingTags", true);
pref("fallbackToAttachmentText", true);
pref("debug", false);
