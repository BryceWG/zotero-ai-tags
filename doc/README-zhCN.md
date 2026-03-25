# Zotero AI Tags

[![Zotero 7](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

这是一个用于 Zotero 7 的 AI 标签插件。它会读取选中条目的摘要与 PDF 附件第一页文本，拼装成文章内容概览，再调用兼容 OpenAI 的大模型接口生成标签，并写回到 Zotero 标签栏。

[English](../README.md) | [简体中文](./README-zhCN.md)

## 当前能力

- 在条目右键菜单中提供 `生成 AI 标签`
- 仅处理当前选中的普通文献条目
- 自动读取 `abstractNote`
- 自动寻找最佳 PDF 附件并优先提取第 1 页文本
- 当 PDF 首页提取失败时，可回退到附件全文开头
- 解析模型返回的 JSON 标签并去重写回
- 在 Zotero 设置页中支持自定义标签规则
- 支持为指定分类及其子分类设置额外标签规则

当前实现默认是保守模式：

- 默认只追加新标签，不删除旧标签
- 默认只发送必要的摘要和 PDF 首页文本片段
- 不会自动扫描整个文库

## 使用方式

1. 打开 Zotero 设置中的 `Zotero AI Tags`
2. 填写：
   - `API Base URL`
   - `API Key`
   - `模型名称`
   - `API 额外参数`（注入到请求体的 JSON 对象）
   - `标签生成规则`
   - `分类标签规则`（对指定分类及其子分类追加额外约束）
   - `每篇文献最多生成标签数`
   - `API 最大并发请求数`
   - `API 每秒最大请求数（RPS）`
3. 在条目列表中选中一条或多条文献
4. 右键点击，选择 `生成 AI 标签`

当前默认对接 OpenAI 兼容的 `/chat/completions` 接口。

## 插件 API

其他 Zotero 插件可以通过 `Zotero.AITags.api` 调用：

```js
await Zotero.AITags.api.generateTagsForSelection();
await Zotero.AITags.api.generateTagsForItem(item);
await Zotero.AITags.api.generateTagsForItems(items);
```

## 开发环境

### 环境要求

1. Zotero 7 beta 或更新版本
2. Node.js LTS
3. Git

### 初始化

```sh
npm install
cp .env.example .env
```

然后编辑 `.env`，填写 Zotero 可执行文件路径和开发 profile 路径。

### 常用命令

```sh
npm start
npm run build
npm run lint:check
npm run test
```

- `npm start`：启动开发模式与热重载
- `npm run build`：生产构建并执行 TypeScript 检查
- `npm run lint:check`：运行 Prettier 与 ESLint
- `npm run test`：运行基础启动测试

## 目录说明

```text
addon/
  content/preferences.xhtml    设置页 UI
  locale/                      Fluent 本地化文件
  prefs.js                     运行时首选项默认值
src/
  hooks.ts                     生命周期入口与注册逻辑
  modules/aiTags/              AI 标签主流程
  modules/preferenceScript.ts  设置页绑定逻辑
  utils/                       通用工具
test/
  startup.test.ts              基础启动检查
```

## 实现约束

- LLM 返回值必须是 `{"tags":["..."]}` 形式的 JSON
- `typings/` 下的类型文件由脚手架生成，不手动修改
- PDF 首页提取优先走 Zotero Reader / PDF.js，失败后再走附件全文回退
- 标签写回前会做裁剪、标准化与去重

## 参考资料

- [Zotero 7 插件开发文档](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit)
- [zotero-plugin-scaffold](https://github.com/northword/zotero-plugin-scaffold)
- [zotero-types](https://github.com/windingwind/zotero-types)

## 许可证

AGPL-3.0-or-later
