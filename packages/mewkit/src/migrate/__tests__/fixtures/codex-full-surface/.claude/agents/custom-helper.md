---
name: custom-helper
description: Custom (non-roster) user agent exercising reference rewriting + model annotation
tools: Read,Grep
model: opus
memory: .claude/memory/custom-helper.md
---

# Custom Helper

A user-authored agent that is NOT part of the toolkit roster, so the authored-bundle
overlay never overwrites its converted output — the converter's ref-rewriting and
model-annotation behavior is asserted against this agent post-cutover.

<!-- ref: fenced-runtime-command -->
```bash
node .claude/scripts/validate-docs.cjs --strict
python3 .claude/skills/demo-skill/scripts/run.py
```
