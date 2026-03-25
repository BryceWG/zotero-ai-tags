# Zotero AI Tags

[![Zotero 7](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

Generate Zotero tags with an LLM from item abstracts and the first page of attached PDFs.

[English](README.md) | [简体中文](doc/README-zhCN.md)

## What it does

- Adds a right-click item menu entry: `Generate AI Tags`
- Reads the selected regular item's abstract and tries to extract text from page 1 of the best PDF attachment
- Builds a compact article overview and sends it to an OpenAI-compatible chat completion API
- Parses JSON output and writes the generated tags back to the item's tag list
- Supports user-defined tagging rules in the Zotero preferences pane

The current implementation is intentionally conservative:

- It only works on the current selection
- It appends tags by default and does not delete existing tags unless configured
- It falls back to attachment full text when first-page extraction is unavailable

## Preferences

Open `Edit -> Preferences -> Zotero AI Tags` and configure:

- `API Base URL`
- `API Key`
- `Model`
- `Tagging Rules`
- `Maximum tags per item`
- `Request timeout`
- `Maximum concurrent API requests`
- `Maximum API requests per second (RPS)`
- Whether to keep existing tags
- Whether to fall back to attachment full text
- Debug logging

Default API settings target the OpenAI-compatible `/chat/completions` interface.

## Development

### Requirements

1. Zotero 7 beta or newer
2. Node.js LTS
3. Git

### Setup

```sh
npm install
cp .env.example .env
```

Edit `.env` and set the Zotero executable path and development profile path.

### Commands

```sh
npm start
npm run build
npm run lint:check
npm run test
```

## Project structure

```text
addon/
  content/preferences.xhtml    Preference pane UI
  locale/                      Fluent localization files
  prefs.js                     Runtime plugin preferences
src/
  hooks.ts                     Lifecycle registration
  modules/aiTags/              Tag generation workflow
  modules/preferenceScript.ts  Preference pane bindings
  utils/                       Locale, prefs, toolkit helpers
test/
  startup.test.ts              Basic startup checks
```

## Implementation notes

- PDF page extraction first tries Zotero's built-in reader instance and PDF.js page text content
- LLM responses must be JSON in the form `{"tags":["..."]}`
- Generated typings in `typings/` are scaffold output and should not be edited manually
- This repository still follows the `zotero-plugin-template` + `zotero-plugin-scaffold` workflow for packaging and release

## License

AGPL-3.0-or-later
