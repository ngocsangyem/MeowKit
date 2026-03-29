<!-- Extracted from SKILL.md for progressive disclosure (checklist #11, #14) -->
<!-- gstack shared protocols: AskUserQuestion, Completeness, Repo Mode, Search, Contributor, Telemetry -->

## AskUserQuestion Format

**ALWAYS follow this structure for every AskUserQuestion call:**

1. **Re-ground:** State the project, the current branch (use `_BRANCH` from preamble), and the current plan/task.
2. **Simplify:** Explain the problem in plain English a smart 16-year-old could follow.
3. **Recommend:** `RECOMMENDATION: Choose [X] because [one-line reason]` — include `Completeness: X/10` for each option.
4. **Options:** Lettered options: `A) ... B) ... C) ...` — show both effort scales: `(human: ~X / CC: ~Y)`
5. **One decision per question:** NEVER combine multiple independent decisions into a single AskUserQuestion.

## Completeness Principle — Boil the Lake

AI-assisted coding makes the marginal cost of completeness near-zero. Always recommend the complete implementation over shortcuts. "Good enough" is the wrong instinct when "complete" costs minutes more.

| Task type | Human team | MeowKit | Compression |
|-----------|-----------|---------|-------------|
| Boilerplate / scaffolding | 2 days | 15 min | ~100x |
| Test writing | 1 day | 15 min | ~50x |
| Feature implementation | 1 week | 30 min | ~30x |
| Bug fix + regression test | 4 hours | 15 min | ~20x |

## Repo Ownership Mode

`REPO_MODE` from the preamble:
- **`solo`** — One person does 80%+ of the work. When you notice issues, investigate and offer to fix proactively.
- **`collaborative`** — Multiple active contributors. Flag issues via AskUserQuestion, don't auto-fix.
- **`unknown`** — Treat as collaborative (safer default).

## Search Before Building

Before building infrastructure or unfamiliar patterns, search first. Three layers: Layer 1 (tried and true), Layer 2 (new and popular), Layer 3 (first principles). Log eureka moments to `.claude/memory/eureka.jsonl`.

## Contributor Mode

If `_CONTRIB` is `true`: At the end of each major workflow step, reflect on MeowKit tooling. Rate 0-10. File field reports to `.claude/memory/contributor-logs/{slug}.md` for actionable bugs. Max 3 per session.

## Completion Status Protocol

Report status: **DONE**, **DONE_WITH_CONCERNS**, **BLOCKED**, or **NEEDS_CONTEXT**. Escalation after 3 failed attempts.

## Telemetry (run last)

After workflow completes, log telemetry:
```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f .claude/memory/.pending-"$_SESSION_ID" 2>/dev/null || true
```

## Plan Status Footer

When in plan mode before calling ExitPlanMode: check for existing `## MEOWKIT REVIEW REPORT` section. If absent, run `.claude/scripts/bin/meowkit-review-log` and write the report table.
