---
name: mk:llms
description: "Generates llms.txt from project docs."
argument-hint: '[--source path] [--full] [--output dir] [--base-url url]'
source: local
original_path: .claude/skills/llms/SKILL.md
adapted_for: claude-code
keywords:
  - llms
  - llms-txt
  - llm-friendly-docs
  - ai-discoverability
  - agentic-content
when_to_use: "Make a project AI-discoverable."
user-invocable: true
owner: docs
criticality: medium
status: active
runtime: claude-code
requires_runtime: [python>=3.9]
---

# llms.txt Generator

Generate [llms.txt](https://llmstxt.org/) files — LLM-friendly markdown indexes of project documentation.

> Run from the project root. The script path below is relative to this skill's directory.

## When to Use

- Project needs LLM-friendly documentation index
- User asks for "llms.txt", "LLM documentation", "AI-friendly docs"
- Publishing docs site and want AI discoverability
- After major documentation updates

Explicit: `/mk:llms [--source path] [--full]`

## Workflow Integration

On demand, or after docs change. Output supports the `documenter` agent.

## Arguments

| Flag            | Effect                                            |
| --------------- | ------------------------------------------------- |
| (no args)       | Scan `./docs`                                     |
| `--source path` | Scan a specific directory (default `./docs`)      |
| `--full`        | Also generate `llms-full.txt` with inline content |
| `--output dir`  | Output directory (default: project root)         |
| `--base-url url` | Base URL prefix for links                        |

## Scripts

**Script-first approach** — the Python script handles all deterministic work (scanning, extracting, categorizing, generating). Claude only reviews and improves the output.

```bash
# Generate llms.txt (script does the heavy lifting)
node .claude/hooks/lib/skill-python.cjs ${CLAUDE_SKILL_DIR}/scripts/generate-llms-txt.py \
  --source ./docs [--output .] [--base-url https://example.com/docs] [--full]

# Preview metadata first (Claude reviews before generating)
node .claude/hooks/lib/skill-python.cjs ${CLAUDE_SKILL_DIR}/scripts/generate-llms-txt.py \
  --source ./docs --json
```

## Process

1. **Run script** — execute `generate-llms-txt.py --source <path> --json` to preview metadata
2. **Review metadata** — check project name, description, file categorization
3. **Generate** — run script again without `--json` to produce llms.txt
4. **Review output** — read generated llms.txt, improve descriptions if needed
5. **Validate** — run these four checks and fix what fails (the full rules are in `references/llms-txt-spec.md`): the file starts with one H1; a blockquote summary follows; every list entry is `- [title](url): description`; an `Optional` section, if present, is last
6. If `--full`: review llms-full.txt for completeness
7. Return the output path(s) and the four-status block from `.claude/rules/agent-conduct.md` (A1)

## Output Format

```markdown
# {Project Name}

> {Brief project description with essential context.}

## {Section Name}

- [{Doc Title}]({url}): {Brief description}
- [{Another Doc}]({url}): {What this covers}

## Optional

- [{Less Important Doc}]({url}): {Supplementary info}
```

## References

| Reference                                             | When to load        | Content                              |
| ----------------------------------------------------- | ------------------- | ------------------------------------ |
| **[llms-txt-spec.md](./references/llms-txt-spec.md)** | Step 4 — generating | Full llmstxt.org specification rules |

## Failure Handling

| Failure                  | Recovery                                  |
| ------------------------ | ----------------------------------------- |
| No .md files found       | Report "No documentation found in {path}" |
| No H1 in doc file        | Use filename as title, warn user          |
| Output path not writable | Suggest alternative path                  |

## Constraints

- Never fabricate documentation content — only index what exists
- Follow the llmstxt.org format: other tools parse the file by that structure
- Keep descriptions concise — one sentence per entry

## Gotchas

- **Python venv required**: run `mewkit skill env llms` once from the project root before invoking this skill. Re-run after upgrading the toolkit.
