---
title: Debug Effectively
description: Decision guide — when to use mk:fix, mk:investigate, mk:sequential-thinking, or mk:problem-solving.
---

# Debug Effectively

Four skills handle debugging and problem-solving. Picking the wrong one wastes tokens and produces bad answers. This guide maps each to the right situation.

## One decision matrix

Match the strongest signal in your situation to ONE skill. Don't stack them.

| Your situation | Skill | Why |
|---------------|-------|-----|
| Bug, error, test failure — anything broken, want it fixed | `/mk:fix` | Top-level orchestrator. Invokes scout + investigate + sequential-thinking internally. |
| Pure diagnosis — "why is this broken?" without fixing yet | `/mk:investigate` | 5-phase root-cause debugging. Read-only until hypothesis confirmed. |
| Competing hypotheses — "which of these is correct?" | `/mk:sequential-thinking` | Hypothesis table, evidence-based elimination. Works for architecture decisions too. |
| Stuck on approach — "tried 5 ways, still feels wrong" | `/mk:problem-solving` | Strategic unsticking. 7 techniques. Not for debugging. |

**Default when unsure:** anything that smells like "something is broken" → `/mk:fix`. It invokes the others internally.

## How they compose

`/mk:fix` is the orchestrator. It calls `/mk:investigate` (collect evidence), which calls `/mk:sequential-thinking` (eliminate hypotheses). `/mk:problem-solving` stands apart — it's for strategic blocks, not bugs.

```
Bug reported
  → mk:fix (orchestrator)
    → Step 1: mk:scout (mandatory codebase exploration)
    → Step 2: mk:investigate (collect symptoms, trace backward)
        → Phase 3: mk:sequential-thinking (hypothesis table, evidence elimination)
    → Step 3: Complexity assessment (quick / standard / deep)
    → Step 4: Fix ROOT cause
    → Step 5: Regression test (mandatory)
    → Step 6: Write pattern to memory
```

## Common misroutes

| Wrong | Right | Why |
|-------|-------|-----|
| `/mk:problem-solving` for a bug | `/mk:fix` | problem-solving is for approach, not cause |
| `/mk:sequential-thinking` for a bug you want fixed | `/mk:fix` | fix already invokes sequential-thinking + adds scout + memory + verify |
| `/mk:investigate` then separately `/mk:fix` | `/mk:fix` only | fix Step 2 already invokes investigate. Duplicate work. |
| `/mk:fix` for green-field design | `/mk:plan-creator` | fix is for broken things, not new design |

## Real scenarios

**Test suite red after refactor:**
→ `/mk:fix`. Scout maps the blast radius, investigate collects stack traces, sequential-thinking hypothesizes what changed.

**Intermittent production bug, fixed twice, still recurring:**
→ `/mk:fix` first. Reads memory for prior sessions on this bug class. If the pattern "adding X to fix Y" emerges, follow up with `/mk:problem-solving` (Via Negativa).

**"Why did deployment fail last night?" (CI is green now):**
→ `/mk:investigate`. Pure diagnostic — the deploy already succeeded on retry. Investigate produces a DEBUG REPORT; you decide if a fix is needed.

**Architecture trade-off with competing positions:**
→ `/mk:sequential-thinking`. Not a bug — a reasoning task. Hypothesis table for "pick between known options with evidence."

**Seven implementations, none feel right:**
→ `/mk:problem-solving` → Simplification Cascades. "Same thing 5+ ways, growing special cases" is the trigger for this technique.

## Anti-patterns

- **Guessing root causes** — let sequential-thinking enforce evidence
- **Fixing symptoms** — trace backward to ROOT cause
- **Skipping scout** — `/mk:fix` Step 1 is mandatory
- **No regression test** — `/mk:fix` Step 5 blocks without one
- **3+ failed attempts** — stop and question the architecture

## Next steps

- [Fix a bug](/guides/fix-a-bug) — the full `/mk:fix` walkthrough
- [Build a feature](/guides/build-a-feature)
