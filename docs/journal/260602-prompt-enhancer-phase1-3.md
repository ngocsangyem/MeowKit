# mk:prompt-enhancer v1.4 — Phase 1–3 Completion (Session 3)

**Date**: 2026-06-02 19:00
**Severity**: Medium
**Component**: `.claude/skills/prompt-enhancer`
**Status**: Resolved

## What Happened

Opened Session 3 to execute Phase 2 + 3 on top of a "Complete" Phase 1. Scouting the live `meowkit` repo (clean tree, `main`, no stash, no relevant worktree) showed Phase 1 had never landed: registry row absent, eval baseline empty, `deep-mode-scout.md` L50 still carried the ~100-extension glob, SKILL.md had no arch-review pointer. Session 2 edits were lost or never merged. User approved re-applying Phase 1, then proceeding through Phase 3.

## The Brutal Truth

The plan said "Complete." The repo said otherwise. We built a plan dependency on Session 2 output and skipped the basic verification of checking whether those files actually existed. That's not an oversight — that's trusting a status flag over the source of truth. It cost a full re-apply pass.

## Technical Details

**Phase 1 re-applied (all verified post-write):**
- `trigger-registry.md`: QW1 — new row added, phrases verbatim from SKILL.md L49 ("make this prompt better")
- `deep-mode-scout.md` L50: QW3 — glob narrowed from ~100 extensions to exactly `{ts,tsx,js,jsx,py,go,rs,java,rb,kt,swift,vue}`, matching `scout-context.py SOURCE_EXTENSIONS` (12 exts). Narrow-only; preserves Skill Rule-of-Two at 2/3 (never pushing `--deep` to 3/3)
- `eval/baseline.md`: QW2 — default canaries #1–6 + recipe #11–12 recorded PASS; deep #7–10 deferred (no fixture)
- `SKILL.md` "When to use": QW4 — arch-review pointer added

**Phase 2 (MI1–MI4):**
- `references/mode-routing.md` created; universal-kernel rule single-sourced to SKILL.md HC#4; deep-mode fallback single-sourced to `deep-mode-scout.md` — all restatements removed, replaced with pointers
- `references/architecture-review-mode.md` recipe + optional arch OUTPUT FORMAT block in `output-template.md`
- Canaries 11 (arch-review) and 12 (research) written; new HARD-FAIL rubric dimension #10 role-boundary added to `eval/rubric.md`
- `mk:scout` ownership reworded to "bounded hint scanner"; detection-vs-safeguards no-double-fire precedence note added

**Phase 3 (MR1–MR2):**
- MR1: chose option (a) bounded-hint-scanner — formalized in `scout-context.py` docstring + `deep-mode-scout.md` contract; option (b) true `mk:scout` consumer left as a future non-breaking enhancement
- MR2: executable eval runner not feasible — canaries require LLM judgment against prose gold standards; canary-09 transcript audit is not self-inspectable. Limitation documented in `eval/README.md "Automation status"`. No fake runner built.

**Verification:**
- `npx mewkit validate` → 32 passed, 1 pre-existing inert `depends_on` pack warning
- SKILL.md = 185 lines (hard limit ≤185; exactly at the boundary)
- 500-line rule: all files pass
- `code-reviewer` subagent: 8/8 acceptance criteria PASS, 0 blockers, 0 mandate creep, glob/extension match confirmed exact
- `py_compile` OK on `scout-context.py`

## Root Cause Analysis

Session 2 wrote its edits into a checkout that was never committed or stashed in a recoverable location. The plan's status field was updated to "Complete" anyway. Session 3 inherited that status with no skepticism and began building on a foundation that did not exist. The root cause is trusting plan metadata over the actual files on disk.

## Lessons Learned

1. **Verify before building on a dependency.** Before any session that extends a prior "Complete" phase, grep or read at least one key artifact from that phase. A 10-second file existence check here would have confirmed the loss before the session started, not after.
2. **Recipe-over-flag is the right call.** Architecture-review and research-style prompts ship as documented recipes on existing modes, each guarded by a canary. This keeps the skill's mandate clean without adding flag surface area.
3. **Fake runners are worse than no runners.** MR2's decision to document the automation limitation honestly rather than wire a runner that would rubber-stamp prose output is the right call. A passing fake test suite is a liability disguised as coverage.
4. **Narrow-only on allow surfaces.** Expanding the deep-mode glob would push Skill Rule-of-Two to 3/3 and violate `injection-rules.md` Rule 11. When in doubt, match the script exactly and document the mirror constraint.

## Next Steps

- **Separate plan**: resolve the `trigger-registry.md` table-vs-preamble schema mismatch (4-col table vs 5-col preamble; affects all 7+ existing rows — pre-existing, not introduced here)
- **Future MR1 option (b)**: if a true `mk:scout` consumer is ever needed, the bounded-hint-scanner contract in `deep-mode-scout.md` provides the documented upgrade path without breaking changes
- **Deep canaries #7–10**: unblock by choosing a caller-provided git fixture; then baseline can be fully recorded

---

**Status:** DONE
**Summary:** Phases 1–3 of mk:prompt-enhancer v1.4 complete after re-applying lost Session-2 Phase 1 edits; all 8 acceptance criteria pass, validation clean, no mandate creep.
