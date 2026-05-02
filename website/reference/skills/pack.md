---
title: "mk:pack"
description: "Pack an EXTERNAL repository into a single AI-friendly file (markdown/xml/json). Use for third-party library analysis, security audits, or handoff to external LLMs."
---

# mk:pack

## What This Skill Does

Pack snapshots an external repository into a single AI-friendly file via `repomix`. The output is a portable, shareable document for pasting into external LLMs (ChatGPT, Gemini, claude.ai web), distributing to reviewers, or archiving. It includes a secret scan by default and supports Tree-sitter-based `--compress` mode that extracts only class/function/interface signatures.

## When to Use

Triggers:
- Pasting a third-party library into an external LLM for analysis
- Security audit of `vendor/library` before adoption -- one file for review
- Research or offline reading of an unfamiliar repo
- Creating a shareable snapshot for code review or issue filing
- Extracting API surface signatures with `--compress`

Anti-triggers:
- **Packing the current project to re-read in Claude Code.** Claude Code already reads files lazily. Use `mk:scout` for inbound analysis instead.
- Replacing `mk:scout` for structured codebase exploration -- pack produces a flat dump; scout produces an architectural fingerprint.
- Adopting external code into your project -- use `mk:chom` for replication workflows.

## Core Capabilities

- **Multi-format output** -- markdown, XML, JSON, or plain text
- **File selection** -- `--include` and `--ignore` glob patterns, plus `--remove-comments` for supported languages
- **API surface extraction** -- `--compress` uses Tree-sitter to extract only signatures (classes, functions, interfaces), producing a compact artifact
- **Secret scanning** -- Secretlint scan runs by default; warnings are surfaced to the user
- **Self-pack guard** -- blocks packing the current git root unless `--self` is explicitly passed
- **Auto-generated output path** -- `.claude/packs/{YYYYMMDD-HHMM}-{slug}.{ext}`

## Arguments

| Flag | Effect |
|------|--------|
| `--style markdown\|xml\|json\|plain` | Output format (default: `markdown`) |
| `--include <pattern>` | Comma-separated globs to force inclusion |
| `--ignore <pattern>` | Additional ignore patterns (`.gitignore` respected by default) |
| `--remove-comments` | Strip comments for supported languages |
| `--compress` | Tree-sitter signature extraction -- API surface only |
| `--self` | Allow packing the current git root (rare override) |
| `--no-security-check` | Disable Secretlint scan (emits explicit warning) |
| `--output <path>` | Override the auto-generated output path |

## Workflow

1. **Parse source** -- classify as remote (`owner/repo`, GitHub URL) or local path.
2. **Self-pack guard** -- block if target resolves to current git root and `--self` not passed.
3. **Compute output path** -- `.claude/packs/{timestamp}-{slug}.{ext}`.
4. **Invoke repomix** -- `npx --yes repomix@^1.11 [flags] -o "<output>"`.
5. **Surface secret-scan results** -- parse repomix output for security warnings.
6. **Handoff** -- print output path with reminder: "Do NOT Read this file back into the current session."

## Usage

```bash
/mk:pack yamadashy/repomix
/mk:pack https://github.com/vercel/ai --style markdown
/mk:pack vercel/ai --compress
/mk:pack vendor/library --style xml --output audit-library.xml
/mk:pack owner/repo --include "src/**/*.ts" --remove-comments
```

## Example Prompt

```
/mk:pack TanStack/query --compress
"I need just the public API surface to decide if we should adopt it."
```

## Common Use Cases

- Auditing a vendor dependency before adding it to `package.json`
- Pastoring a library's source into ChatGPT to ask architecture questions
- Extracting only the public API of a large library for quick evaluation
- Creating a permanent snapshot of a repo at a specific point in time
- Sharing a filtered view of a codebase (only `src/`, no comments) with a reviewer

## Pro Tips

- **First run is slow (~10s).** `npx` fetches repomix on first invocation. Subsequent runs use the npm cache.
- **`--compress` is a genuine win for API queries.** It produces a small, signature-only artifact that `mk:scout` cannot match. Use it for "what's the public API of library X" questions.
- **Never Read packed output back into Claude Code.** It defeats the purpose and burns context. Paste into an external LLM instead.
- **Offline first run fails.** `npx` needs network until repomix is cached. Run `npx repomix --version` once online to warm the cache.
- **Secret scanner is defense-in-depth, not audited.** Review output manually before sharing externally.

> **Canonical source:** `.claude/skills/pack/SKILL.md`
