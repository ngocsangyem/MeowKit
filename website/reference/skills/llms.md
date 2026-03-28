---
title: "meow:llms"
description: "Generate llms.txt files from project documentation following the llmstxt.org specification."
---
# meow:llms
Generate llms.txt files from project documentation following the llmstxt.org specification.
## What This Skill Does
Generates `llms.txt` (and optionally `llms-full.txt`) files that make your project documentation discoverable by AI assistants. A Python script handles scanning, title extraction, categorization, and generation — Claude only reviews and improves the output.
## Core Capabilities
- **Script-driven** — `generate-llms-txt.py` does all deterministic work
- **Auto-categorization** — Groups docs into Getting Started, API Reference, Guides, Architecture, etc.
- **Project auto-detection** — Reads package.json/README for project name and description
- **JSON preview mode** — `--json` flag outputs metadata for Claude to review before generating
- **Full mode** — `--full` generates llms-full.txt with inline content
## Usage
```bash
/meow:llms                                    # scan docs/ directory
/meow:llms --full                             # also generate llms-full.txt
/meow:llms --source ./docs --base-url https://example.com/docs
python3 .claude/skills/meow:llms/scripts/generate-llms-txt.py --source ./docs --json  # preview
```
::: info Skill Details
**Phase:** 6  
**Used by:** documenter agent
:::

## Related
- [`meow:docs-finder`](/reference/skills/docs-finder) — Consumes llms.txt (inverse operation)
