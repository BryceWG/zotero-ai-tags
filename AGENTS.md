# AGENTS

## 项目目标

`zotero-ai-tags` 是一个 Zotero 7 插件，用于对当前选中的文献条目生成 AI 标签。

核心流程：

1. 读取条目摘要 `abstractNote`
2. 获取最佳 PDF 附件
3. 提取 PDF 第 1 页文本；失败时按设置回退到附件全文开头
4. 根据用户规则构造 prompt，调用兼容 OpenAI 的聊天接口
5. 解析 JSON 标签、去重，并写回 Zotero 条目标签栏

## 目录约定

- `src/`：TypeScript 源码
- `src/hooks.ts`：生命周期注册与插件初始化，只做分发和注册
- `src/modules/aiTags/`：AI 标签主流程
- `src/modules/preferenceScript.ts`：设置页绑定逻辑
- `src/utils/`：本地化、prefs、toolkit 等通用工具
- `addon/`：插件静态资源、prefs、manifest、xhtml、FTL
- `test/`：基础测试
- `typings/`：由 scaffold 生成，禁止手工修改

## 开发命令

- `npm start`：启动 Zotero 开发模式与热重载
- `npm run build`：构建插件并执行 `tsc --noEmit`
- `npm run lint:check`：执行 Prettier 与 ESLint
- `npm run test`：运行插件测试

## 代码风格

- 使用 TypeScript
- 默认保持 ASCII；仅在现有中文文案或本地化文件中使用中文
- 避免在 `hooks.ts` 中堆积业务逻辑
- 优先拆分纯函数，减少对 Zotero UI 状态的直接耦合
- 所有用户可见文案优先放入 FTL
- 设置项统一通过 `src/utils/prefs.ts` 读写

## 插件行为边界

- 只处理当前选中的条目，不主动扫描整个文库
- 默认不删除旧标签，只追加新标签
- 默认只发送摘要与 PDF 首页文本等必要片段给 LLM
- 对不可编辑条目、无摘要条目、无可用 PDF 文本条目要安全跳过
- 不记录 `apiKey`、完整原文和其他敏感信息到日志

## LLM 调用规范

- 当前接口目标是 OpenAI 兼容的 `/chat/completions`
- 请求必须带 `model`、`messages`、`Authorization: Bearer <apiKey>`
- 响应内容必须解析为 JSON，格式为 `{"tags":["..."]}`
- 对 `401/403` 视为配置错误直接提示
- 对 `429` 与瞬时服务异常要允许有限重试或友好失败
- 调试日志中只能记录状态、条目 ID、错误摘要，不记录密钥

## PDF 与标签处理

- PDF 提取优先使用 Zotero Reader / PDF.js 的第 1 页文本
- 若 Reader 路径失败且设置允许，则回退到 `attachmentText`
- 标签需执行：`trim`、空值过滤、长度限制、NFKC 归一化、去重
- 避免输出整句、纯符号标签、明显重复标签

## 首选项约定

当前关键设置项：

- `enable`
- `apiBaseURL`
- `apiKey`
- `model`
- `userRules`
- `maxTags`
- `timeoutMs`
- `maxConcurrentRequests`
- `requestsPerSecond`
- `preserveExistingTags`
- `fallbackToAttachmentText`
- `debug`

新增设置时必须同步更新：

1. `addon/prefs.js`
2. `addon/content/preferences.xhtml`
3. `addon/locale/en-US/preferences.ftl`
4. `addon/locale/zh-CN/preferences.ftl`

## 验证方式

提交较大改动前至少执行：

1. `npm run build`
2. `npm run lint:check`

建议补充手工冒烟：

- 单条：有摘要、有 PDF
- 单条：有摘要、无 PDF
- 单条：无摘要、有 PDF
- 多条批量
- API Key 错误
- PDF 首页提取失败并触发回退
- 只读库或不可编辑条目

## Agent 工作建议

- 先读 `README.md` 与 `doc/README-zhCN.md`，再动代码
- 修改本地化或 prefs 后，优先运行 `npm run build` 让 scaffold 重新生成类型
- 若发现 `typings/` 变化，确认是构建产物，不要手写修补
- 涉及 Zotero API 时，优先查 `zotero-types`，必要时再查 Zotero 源码
