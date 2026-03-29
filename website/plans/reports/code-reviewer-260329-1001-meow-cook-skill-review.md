# Code Review: meow:cook Skill Improvement

**Score: 8.5/10**
**Critical: 0 | Warnings: 5 | Suggestions: 4**

## Scope

- Files: 9 (SKILL.md, 4 references, 3 scripts, 1 command)
- LOC: ~702
- Focus: Markdown skill consistency, gate enforcement, cross-references, POSIX scripts

## Overall Assessment

Well-structured skill with strong progressive disclosure. SKILL.md acts as a proper router. Gate 2 enforcement is consistent across all files. TDD alignment is clear. Scripts pass all tests and are POSIX-compatible.

## Warnings (SHOULD FIX)

### W1: Phase numbering mismatch between SKILL.md and cook.md

SKILL.md Mermaid diagram shows: Phase 0, 1, 2, 3, **4: Ship**, **5: Reflect**
But the Required Subagents table at SKILL.md:96-97 labels Phase 4 as both "Review" AND "Ship".
cook.md:35 says "Phase 4 -- Review + Ship" and Phase 5 is "Reflect".

However, the parent `meowkit/CLAUDE.md` defines a **7-phase** workflow:
```
Phase 0 Orient -> Phase 1 Plan [GATE 1] -> Phase 2 Test RED
-> Phase 3 Build -> Phase 4 Review [GATE 2] -> Phase 5 Ship -> Phase 6 Reflect
```

**The skill claims "7-phase" (workflow-steps.md:1) but actually implements 6 phases (0-5).** Review+Ship are merged into Phase 4, and there is no Phase 6. This contradicts the parent CLAUDE.md which separates Review (4) from Ship (5) from Reflect (6).

**Impact:** Agents reading meowkit/CLAUDE.md will expect 7 phases; agents reading cook will find 6. This will cause confusion during orchestration.

**Fix:** Either align cook to the 7-phase numbering (split Review and Ship into separate phases 4 and 5, make Reflect phase 6), or update meowkit/CLAUDE.md to match the 6-phase reality.

### W2: Subagent name inconsistency — "planner" vs "meow:plan-creator"

- SKILL.md:92 uses `meow:plan-creator` (skill name)
- subagent-patterns.md:30 uses `subagent_type="planner"` (agent type)
- workflow-steps.md:25 uses "Invoke `meow:plan-creator`"

The Task() pattern in subagent-patterns.md says `subagent_type="planner"` but SKILL.md says `meow:plan-creator`. These are different things: `subagent_type` is an agent role, `meow:plan-creator` is a skill to activate.

**Fix:** Clarify in subagent-patterns.md that the planner agent should activate the `meow:plan-creator` skill. E.g., `Task(subagent_type="planner", prompt="Use meow:plan-creator to create...")`.

### W3: Plan path inconsistency — "tasks/plans/" vs historical convention

- workflow-steps.md:26 says `tasks/plans/YYMMDD-name/plan.md`
- subagent-patterns.md:30 says `tasks/plans/YYMMDD-name/`
- meowkit/CLAUDE.md says `tasks/plans/YYMMDD-name.md` (flat file, not directory)
- compare-kit CLAUDE.md documentation-management says `./plans/` (different path entirely)

**Impact:** Agents will create plans in inconsistent locations.

**Fix:** Standardize on one path. The meowkit CLAUDE.md uses `tasks/plans/` — all cook references should match.

### W4: HARD-GATE user-override list is overly broad

SKILL.md:27 lists these as skip-planning triggers:
```
"just code it", "skip planning", "do the plan", "just do it", "do it", "go ahead", "let's do it", "let's go"
```

"do it", "go ahead", "let's go" are common approval phrases for proceeding with a PLAN, not for skipping planning. A user saying "go ahead" after seeing a plan summary would accidentally trigger skip-planning mode.

**Impact:** False positives — users approving plans get plan-skipping behavior instead.

**Fix:** Remove ambiguous phrases. Keep only explicit skip-intent phrases: "just code it", "skip planning", "skip the plan", "no plan needed".

### W5: Gate 2 validate script FAIL-count is fragile

validate-gate-2.sh:21 greps for "FAIL|failed|BLOCK" case-insensitively. This means:
- A review comment like "This approach failed to consider..." triggers GATE_2_BLOCKED
- "BLOCK" matches "blocking issue" in prose, not just verdict dimensions
- The word "failed" in a test output quote would trigger false positive

**Impact:** False blocking on legitimate reviews with incidental word matches.

**Fix:** Grep for structured patterns only: `^FAIL:`, `VERDICT: FAIL`, or dimension-specific patterns like `Security: FAIL`. Or require the review output to use a structured format that the script can parse unambiguously.

## Suggestions (NICE TO HAVE)

### S1: Missing reference — tdd-rules.md link

workflow-steps.md:48 says "TDD enforcement per `tdd-rules.md`" but this file lives at `meowkit/system/claude/rules/tdd-rules.md`, not in the cook skill references. The relative path is misleading — it implies a local file.

**Fix:** Use the full path or note it's a top-level rule: "TDD enforcement per `rules/tdd-rules.md`".

### S2: Missing reference — gate-rules.md

SKILL.md:107 says "gate-rules.md says NO exceptions" but gate-rules.md is a top-level rule file, not a cook reference. Readers may look for it inside the cook skill directory.

**Fix:** Same as S1 — qualify the path.

### S3: validate-gate-1.sh — redundant grep

Lines 19-26: The first grep (line 19) checks for `## .*${section}` etc., and if it fails, the case block (lines 21-26) checks more variants. But the first grep already includes `# .*${section}` which would match `## Problem`, making the case fallback for "Problem" partially redundant.

The logic works correctly but could be simplified: just do the variant check directly without the initial broad grep.

### S4: intent-detection.md — "just do it" conflicts with HARD-GATE override

intent-detection.md:24 maps "just do it" to `auto` mode.
SKILL.md:27 HARD-GATE maps "just do it" to skip-planning override.

These are two different behaviors for the same phrase.

**Fix:** Align — either "just do it" means auto mode (intent-detection wins) or means skip planning (HARD-GATE wins). Pick one.

## Consistency Matrix

| Aspect | SKILL.md | workflow-steps.md | cook.md | Verdict |
|--------|----------|-------------------|---------|---------|
| Gate 2 human-only | Yes (L85) | Yes (L105-107, L164) | Yes (L65) | CONSISTENT |
| Phase count | "7-phase" | "7-Phase" title | 6 phases (0-5) | MISMATCH (W1) |
| Mode table | 6 modes | 6 modes in flow summary | N/A (interactive only) | OK |
| Subagent names | Mixed skill/role | Mixed | N/A | MISMATCH (W2) |
| Plan paths | tasks/plans/ | tasks/plans/ | N/A | MISMATCH with parent (W3) |

## Gate 2 Enforcement Audit

| File | Gate 2 = Human? | Location |
|------|-----------------|----------|
| SKILL.md | "Gate 2 requires human approval in ALL modes. No exceptions." | L85 |
| SKILL.md Mode Table | All 6 modes show "Human approval" | L78-83 |
| workflow-steps.md | "Human approval ALWAYS required" | L107 |
| workflow-steps.md | "Gate 2 is ALWAYS human-approved. No mode bypasses it." | L164 |
| review-cycle.md | "Gate 2 requires human approval in ALL modes." | L3 |
| review-cycle.md Auto | "GATE 2 ALWAYS REQUIRES HUMAN APPROVAL. NO EXCEPTIONS." | L57 |
| intent-detection.md | All modes bold **Human** for Gate 2 | L53-58 |
| cook.md | "Gate 2 is NEVER auto-approved." | L65 |

**Verdict: Gate 2 enforcement is fully consistent across all 9 files.**

## Scripts Quality

| Script | POSIX? | Tests Pass? | Issues |
|--------|--------|-------------|--------|
| validate-gate-1.sh | Yes (`#!/bin/sh`, no bashisms) | 3/3 | Minor: redundant grep (S3) |
| validate-gate-2.sh | Yes | 4/4 | Fragile pattern matching (W5) |
| test-scripts.sh | Yes | 7/7 all pass | Clean, good temp cleanup via trap |

## Progressive Disclosure Audit

SKILL.md acts as router with 4 `See references/` links:
- L43: intent-detection.md
- L100: subagent-patterns.md
- L101: workflow-steps.md
- L102: review-cycle.md

No reference content is duplicated in SKILL.md — the mode table (L76-83) and subagent table (L88-98) are summaries, not copies. The Mermaid diagram is authoritative and unique to SKILL.md.

**Verdict: Progressive disclosure is well-implemented.**

## Positive Observations

- Anti-rationalization table (SKILL.md:32-39) is excellent — addresses common LLM skip-reasoning patterns
- HARD-GATE with explicit user-override list prevents rigid enforcement while maintaining safety
- Mermaid diagram declared authoritative (L72) resolves prose-vs-diagram conflicts preemptively
- Auto-mode distinction (auto-fix vs auto-approve) is clearly stated in every relevant file
- Test script uses proper cleanup (`trap 'rm -rf' EXIT`), POSIX arithmetic, and meaningful test names
- Review cycle has max 3 cycles with forced escalation — prevents infinite loops

## Recommended Actions (Priority Order)

1. **W1** — Align phase numbering with meowkit/CLAUDE.md (7 phases vs 6). This is the most impactful inconsistency.
2. **W4** — Remove ambiguous skip-planning phrases ("do it", "go ahead", "let's go"). High risk of false positives.
3. **S4/W4** — Resolve "just do it" conflict between intent-detection (auto) and HARD-GATE (skip planning).
4. **W2** — Clarify subagent_type vs skill name in subagent-patterns.md.
5. **W3** — Standardize plan paths across all files.
6. **W5** — Tighten validate-gate-2.sh pattern matching to structured formats only.

## Unresolved Questions

1. Is the intended phase count 6 (as implemented in cook) or 7 (as declared in meowkit/CLAUDE.md)? Which is canonical?
2. Should `subagent_type` in Task() calls reference agent roles or skill names? The codebase uses both inconsistently.
3. The `--no-test` flag skips Phase 2 (Test RED) entirely — does this also skip the refactoring verification in Phase 3? workflow-steps.md doesn't address this.

---

**Status:** DONE
**Summary:** meow:cook skill scores 8.5/10. Gate 2 enforcement is fully consistent. Main issues: phase count mismatch with parent CLAUDE.md (W1), overly broad skip-planning phrases (W4), and "just do it" semantic conflict (S4). Scripts are POSIX-clean and all 7 tests pass.
**Concerns:** Phase numbering mismatch (W1) will cause orchestration confusion if not resolved before agents use both meowkit/CLAUDE.md and cook SKILL.md in the same session.
