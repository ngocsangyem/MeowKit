---
name: mk:clean-code
description: "Applies KISS, DRY, YAGNI. NOT for mk:simplify."
allowed-tools: Read, Write, Edit
version: 2
priority: CRITICAL
phase: on-demand
trust_level: third-party
injection_risk: low
source: antigravity-kit
keywords:
  - clean-code
  - kiss
  - dry
  - yagni
  - authoring-quality
  - ad-hoc-review
when_to_use: "Writing new code."
user-invocable: true
owner: utility
criticality: medium
status: active
runtime: portable
---

# Clean Code

Goal: apply the repo's own standards to code you are writing, or reviewing outside the current implementation diff, without growing the change.

- Shrinking the diff you just built: `mk:simplify` (behavior-preserving, current diff only).
- The principles (YAGNI, KISS, DRY) and file-size and naming rules are in `.claude/rules/development-rules.md` and the project's `docs/code-standards.md` when it has one. Follow those first; the project's lint config beats the defaults here.

## Before editing any file

1. What imports it, and what does it import? An interface change reaches the importers; edit them in the same task.
2. What tests cover it? Run them after the change.
3. Is it shared? A shared component affects several places.

## Defaults

`references/coding-standards.md` holds naming and structure defaults and the numbers behind "small" (about 50 lines for a function, three levels of nesting). They are rules of thumb: past them, look for a split, and keep the code if the split would be forced.

Stay inside the requested change. Cleaning adjacent code is the user's call (`.claude/rules/core-behaviors.md` 5), so propose it rather than doing it. Explain only what the user needs to know: what changed and why.

## Verify

Run the project's own lint and tests (`npm run lint`, `npm test`, `pytest`). If this host gives the skill no shell, say which checks you could not run. For a fast post-edit scan, use `mk:lint-and-validate`.

## Gotchas

- **Over-abstracting simple code**: a helper for a one-time operation is premature. Three similar lines beat a speculative abstraction.
- **Removing error handling you think is unnecessary**: stripping try/catch at a system boundary loses resilience. Remove it only for internal calls with a guaranteed contract.
