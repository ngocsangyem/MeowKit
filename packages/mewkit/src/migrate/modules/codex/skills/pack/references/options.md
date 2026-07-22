# Pack — Options Reference

Flags supported by `the pack skill`. Maps to `repomix` CLI flags where noted.

## Source (positional, required)

| Format | Example | Repomix flag |
|--------|---------|--------------|
| GitHub shorthand | `yamadashy/repomix` | `--remote yamadashy/repomix` |
| Full URL | `https://github.com/vercel/ai` | `--remote https://github.com/vercel/ai` |
| Local directory | `/path/to/external/repo` or `../other-repo` | positional |

Local paths MUST be outside the current git root unless `--self` is passed.

## Output

| Flag | Default | Maps to | Notes |
|------|---------|---------|-------|
| `--style <type>` | `markdown` | `--style` | `markdown`, `xml`, `json`, `plain` |
| `--output <path>` | auto-generated | `-o` | Override `.claude/packs/...` default |

Auto-generated output path: `.claude/packs/{YYYYMMDD-HHMM}-{slug}.{ext}` where slug is derived from the source (last URL segment or local dir basename).

## File Selection

| Flag | Maps to | Notes |
|------|---------|-------|
| `--include <pattern>` | `--include` | Comma-separated globs, e.g. `"src/**/*.ts,*.md"` |
| `--ignore <pattern>` | `-i` | Additional ignore patterns. `.gitignore` is respected by default. |
| `--remove-comments` | `--remove-comments` | Strip comments for supported languages (TS, Python, Rust, Go, etc.) |
| `--compress` | `--compress` | Tree-sitter signature extraction (class/function/interface bodies omitted). Produces a small API-surface artifact. Best for "what's the shape of library X" queries. |

## Safety

| Flag | Behavior |
|------|----------|
| `--self` | Allow packing the current git root. Without this, the guard script blocks self-pack. |
| `--no-security-check` | Disable Secretlint scan. Emits explicit warning in output. Use only for known-clean repos. |

## Not Exposed by This Skill (use raw `npx repomix` if needed)

- `--copy` (clipboard) — On Claude Code, the clipboard isn't reliably exposed to agents
- `--token-count-tree` — third-party tokenizer produces approximate counts; not a reliable budget signal inside host-runtime sessions
- `--split-output` — multi-file output complicates handoff
- Custom config files (`-c`, `--init`) — out of scope; pass flags directly

## Style → Extension Map

| `--style` | File extension |
|-----------|----------------|
| markdown | `.md` |
| xml | `.xml` |
| json | `.json` |
| plain | `.txt` |

## Example Invocations

```bash
# Default: markdown, auto-named, from remote
the pack skill yamadashy/repomix

# Security audit pattern
the pack skill vendor/library --style xml --output audit-library.xml

# TS-only, comments stripped
the pack skill owner/repo --include "src/**/*.ts" --remove-comments

# Force self-pack (rare, documented override)
the pack skill . --self --style markdown

# API surface only (Tree-sitter signatures)
the pack skill vercel/ai --compress
```
