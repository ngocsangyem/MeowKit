---
title: "Debugging & Thinking Skills — Decision Guide"
description: "When to use meow:fix, meow:investigate, meow:sequential-thinking, and meow:problem-solving — with real invocation chains from the SKILL.md files."
persona: C
---

# Debugging & Thinking Skills — Decision Guide

Four meowkit skills sit on adjacent but distinct axes. Picking the wrong one wastes tokens and produces bad answers. This guide is the boundary map — each rule traced to the actual SKILL.md, not inferred.

## TL;DR — One Decision Matrix

Match the **strongest** signal in your current situation to ONE skill. Do not stack multiple starting skills.

| Your situation | Starting skill | Why |
|---|---|---|
| Bug, error, test failure, CI issue, type error, lint — anything broken | **`meow:fix`** | Top-level bug-fix orchestrator. Mandatorily invokes scout + investigate + sequential-thinking. |
| Pure diagnostic question — "why is this broken?" without intent to fix yet | **`meow:investigate`** | 5-phase root-cause debugging. Read-only until hypothesis confirmed. Feeds into fix later. |
| Structured reasoning about evidence — "these are my hypotheses, which is correct?" | **`meow:sequential-thinking`** | Hypothesis table, evidence-based elimination, revision. Not scoped to bugs — also for architecture decisions. |
| Stuck on **approach**, not on **cause** — "I've built this 5 ways and it still feels wrong" | **`meow:problem-solving`** | Strategic unsticking. 7 non-default techniques. **Not** for debugging. |

::: tip Default when unsure
Anything that smells like "something is broken" → `meow:fix`. It will invoke the others internally. The only time to skip `meow:fix` is when you explicitly do NOT want to fix (just diagnose), or when you are not dealing with a bug at all.
:::

## The Real Composition (from SKILL.md files)

These skills aren't peers — they compose. This diagram reflects exactly what each `SKILL.md` does internally:

```mermaid
flowchart TD
    USER([User reports issue]) --> TRIAGE{What kind of issue?}

    TRIAGE -->|"Bug / error / failure<br/>(fix intent)"| FIX[meow:fix]
    TRIAGE -->|"Why is this broken?<br/>(diagnose only)"| INV[meow:investigate]
    TRIAGE -->|"Which hypothesis is correct?<br/>(reasoning only)"| SEQ[meow:sequential-thinking]
    TRIAGE -->|"Stuck on approach<br/>(not debugging)"| PS[meow:problem-solving]

    FIX -->|Step 0.5| MEM[(.claude/memory/fixes.md)]
    FIX -->|"Step 1 — MANDATORY"| SCOUT[meow:scout]
    FIX -->|"Step 2 — MANDATORY"| INV2[meow:investigate]
    FIX -->|"Step 2 — MANDATORY"| SEQ2[meow:sequential-thinking]
    FIX --> FIX_IMPL[Step 3–5: fix + verify + prevent]
    FIX --> LEARN[("Step 6: write to<br/>.claude/memory/fixes.md")]

    INV -->|"Phase 3 — Hypothesize"| SEQ3[meow:sequential-thinking]

    PS -.->|Explicit boundary:<br/>'code broken' → reroute| FIX

    style FIX fill:#4a90e2,color:#fff
    style PS fill:#f39c12,color:#fff
    style INV fill:#27ae60,color:#fff
    style SEQ fill:#9b59b6,color:#fff
```

Read this diagram as: **`meow:fix` is the orchestrator that calls `meow:investigate` which calls `meow:sequential-thinking`**. `meow:problem-solving` stands apart — it's the only one on the strategic-unsticking axis, not the debugging axis.

## Which Skill to Start With — Decision Tree

```mermaid
flowchart TD
    START([I need help]) --> Q1{Is something<br/>broken / failing /<br/>producing errors?}

    Q1 -->|Yes| Q2{Do I want to FIX it<br/>in this session?}
    Q1 -->|No| Q3{Am I stuck on<br/>an APPROACH?}

    Q2 -->|Yes| USE_FIX["/meow:fix [issue]"]
    Q2 -->|"No — just understand why"| USE_INV["/meow:investigate [issue]"]

    Q3 -->|"Yes — 'tried 5 ways',<br/>'told impossible',<br/>'bloated', etc."| USE_PS["/meow:problem-solving"]
    Q3 -->|"No — I have hypotheses<br/>and need to pick one"| USE_SEQ["/meow:sequential-thinking"]

    USE_FIX -->|"invokes internally"| USE_INV
    USE_INV -->|"invokes internally"| USE_SEQ

    style USE_FIX fill:#4a90e2,color:#fff
    style USE_INV fill:#27ae60,color:#fff
    style USE_SEQ fill:#9b59b6,color:#fff
    style USE_PS fill:#f39c12,color:#fff
```

## Skill-by-Skill: What Actually Happens

### `meow:fix` — The Top-Level Bug Orchestrator

**When it triggers:** bug, error, test failure, CI issue, type error, lint, log error, UI issue, code problem. The description is intentionally broad — this is the front door for anything broken.

**What it actually does** (from `.claude/skills/meow:fix/SKILL.md`):

```mermaid
flowchart LR
    BUG([Bug reported]) --> S0[Step 0: Mode select<br/>auto / review / quick]
    S0 --> S05[Step 0.5: Read<br/>.claude/memory/fixes.md]
    S05 --> S1[Step 1: MANDATORY scout<br/>meow:scout]
    S1 --> S2[Step 2: MANDATORY diagnose]
    S2 --> INV2[meow:investigate<br/>collect symptoms]
    S2 --> SEQ2[meow:sequential-thinking<br/>hypothesis + evidence]
    INV2 --> ROOT{Root cause<br/>confirmed?}
    SEQ2 --> ROOT
    ROOT -->|"confidence < medium"| BLOCK[BLOCK — gather more evidence]
    ROOT -->|confirmed| S3[Step 3: Complexity<br/>simple / moderate / complex]
    S3 --> S4[Step 4: Fix ROOT cause]
    S4 --> S5[Step 5: Verify + regression test<br/>MANDATORY]
    S5 -->|"fail <3"| S2
    S5 -->|"fail 3+"| STOP[STOP — question architecture]
    S5 -->|pass| S6[Step 6: Write to memory<br/>.claude/memory/fixes.md + .json]

    style BLOCK fill:#e74c3c,color:#fff
    style STOP fill:#e74c3c,color:#fff
    style ROOT fill:#f39c12,color:#fff
```

**Hard gates:**
- HARD-GATE — no fix proposed before Steps 1–2 (scout + diagnose) complete
- BLOCK — confidence below "medium" forces more evidence
- STOP — 3 failed fix attempts triggers architecture review, not a fourth attempt

**Use `meow:fix` when:** you have a concrete broken thing AND you want it fixed this session.

### `meow:investigate` — Pure Root-Cause Debugging

**When it triggers:** "debug this", "why is this broken", "root cause analysis", troubleshooting.

**What it actually does** (from `.claude/skills/meow:investigate/SKILL.md`):

```mermaid
flowchart LR
    SYM([Symptoms reported]) --> P1[Phase 1: Investigate<br/>errors, traces, repro]
    P1 --> P2[Phase 2: Analyze<br/>trace backward to cause]
    P2 --> P3[Phase 3: Hypothesize]
    P3 --> SEQ3[meow:sequential-thinking<br/>test each hypothesis]
    SEQ3 -->|"≥3 hypotheses fail"| ESC[3-strike rule:<br/>ESCALATE to human]
    SEQ3 -->|confirmed| P4[Phase 4: Implement fix]
    P4 --> P5[Phase 5: Verify<br/>regression test required]
    P5 --> REPORT[DEBUG REPORT output]

    style ESC fill:#e74c3c,color:#fff
    style SEQ3 fill:#9b59b6,color:#fff
```

**Constraints (real, from SKILL.md):**
- Read-only until hypothesis confirmed
- Freeze hook on `Edit` / `Write` — enforces scope boundary via `bin/check-freeze.sh`
- 3-strike rule — if 3 hypotheses fail, escalate; do not keep guessing
- `> 5 files touched` — `AskUserQuestion` about blast radius first

**Use `meow:investigate` when:** you want to understand the root cause without necessarily fixing it in the same session. Also fires automatically inside `meow:fix` Step 2.

### `meow:sequential-thinking` — The Reasoning Engine

**When it triggers:** complex multi-step reasoning, debugging where root cause isn't obvious, architecture decisions with competing trade-offs, `meow:fix` diagnosis phase, any "I think it's X" that needs evidence.

**What it actually does** (from `.claude/skills/meow:sequential-thinking/SKILL.md`):

```mermaid
flowchart LR
    PROB([Problem to reason about]) --> S1[1. State the problem<br/>observed vs expected]
    S1 --> S2[2. Generate hypotheses<br/>from evidence, not guessing]
    S2 --> S3[3. Test each<br/>via Grep / Read / Bash]
    S3 --> S4[4. Eliminate:<br/>CONFIRMED / REFUTED / INCONCLUSIVE]
    S4 --> S5[5. Conclude<br/>root cause + confidence]
    S5 --> S6[6. Scope the fix]
    S4 -.->|new evidence contradicts| REV[Explicit revision<br/>REVISION of Hypothesis N]
    REV --> S2

    style REV fill:#f39c12,color:#fff
```

**Diagnostic framework references (new in v2.4.5):**
- `references/five-whys-plus.md` — post-mortems, recurring problems, human-error investigations
- `references/scientific-method.md` — A/B tests, performance investigations, production incidents
- `references/kepner-tregoe.md` — multi-system bugs, contested root causes (IS/IS-NOT matrix)

**Use `meow:sequential-thinking` when:** you have competing hypotheses and need the evidence-based elimination discipline. Works standalone for architecture decisions too.

### `meow:problem-solving` — The Non-Debugging Sibling

**When it triggers:** stuck on **approach** (not cause). Complexity spiraling, innovation block, recurring patterns, forced-assumption solutions, scale uncertainty, told-it's-impossible, bloated systems needing subtraction.

**What it actually does** (from `.claude/skills/meow:problem-solving/SKILL.md`):

```mermaid
flowchart LR
    STUCK([Stuck on approach]) --> MATCH{Match symptom<br/>to technique}
    MATCH -->|"5+ implementations"| T1[Simplification Cascades]
    MATCH -->|"need breakthrough"| T2[Collision-Zone Thinking]
    MATCH -->|"pattern in 3+ places"| T3[Meta-Pattern Recognition]
    MATCH -->|"'must be this way'"| T4[Inversion Exercise]
    MATCH -->|"'should scale fine'"| T5[Scale Game]
    MATCH -->|"told impossible"| T6[First Principles]
    MATCH -->|"bloated, add > remove"| T7[Via Negativa]

    T1 & T2 & T3 & T4 & T5 & T6 & T7 --> APPLY[Apply ONE technique<br/>load reference, not preload]
    APPLY --> RESOLVED{Resolved?}
    RESOLVED -->|yes| DONE([Proceed])
    RESOLVED -->|no| COMBINE[Combine 2 techniques<br/>e.g. Scale + Via Negativa]

    MATCH -.->|"code broken"| REROUTE[Route to meow:sequential-thinking]

    style REROUTE fill:#e74c3c,color:#fff
```

**Explicit boundary (baked into the description):**

> For evidence-based root-cause debugging, use `meow:sequential-thinking` instead.

**Use `meow:problem-solving` when:** the block is *how* to approach a problem, not *why* something broke.

## Five Real Scenarios — Mapped to Skills

### Scenario 1: Test suite red after a refactor

> "I refactored the auth middleware. Three tests now fail with `TypeError: cannot read property 'id' of undefined`."

→ **`meow:fix`**. Concrete broken thing + fix intent + error signal. `meow:fix` will invoke scout (map refactor blast radius), investigate (collect stack traces), sequential-thinking (hypothesize what changed), then fix the root cause.

### Scenario 2: Intermittent production bug, already fixed twice, still recurring

> "Payment retries succeed most of the time but we see 0.3% duplicate-charge reports. We added idempotency keys last sprint. Still happening."

→ **`meow:fix`** first. It will read `.claude/memory/fixes.md` for prior sessions on this bug class. If the pattern "adding X to fix problem caused by adding Y" emerges during diagnosis, follow up with **`meow:problem-solving`** (Via Negativa) to consider removing the retry wrapper rather than adding a fourth guard.

### Scenario 3: "Why did deployment fail last night?"

> "The 22:00 deploy went red but CI is green now. What happened?"

→ **`meow:investigate`**. Pure diagnostic intent — no fix is required yet; the deploy already succeeded on retry. `meow:investigate` produces a DEBUG REPORT; you decide afterward if a fix is needed.

### Scenario 4: Architecture trade-off with competing positions

> "Should we move order-processing to a queue or keep it inline? I have arguments for both."

→ **`meow:sequential-thinking`** directly. Not a bug, not stuck on approach — a reasoning task. The hypothesis table supports "pick between known options with evidence." For multi-perspective debate, escalate to `meow:party`.

### Scenario 5: Seven features built, none feel right

> "I've implemented this notification system five different ways. Every implementation has ugly special cases."

→ **`meow:problem-solving`** → Simplification Cascades. "Same thing 5+ ways, growing special cases" is the trigger-row for this technique. Look for the one insight that eliminates the special cases.

## The Common Misroutes

These are the patterns meowkit users hit most often. Memorize them.

| Wrong | Right | Why |
|---|---|---|
| Starting with `meow:problem-solving` for a bug | `meow:fix` or `meow:investigate` | problem-solving's description explicitly reroutes "code broken" away. Its axis is approach, not cause. |
| Starting with `meow:sequential-thinking` for a bug you want fixed | `meow:fix` | `meow:fix` already invokes sequential-thinking at Step 2 AND adds scout + memory + verify + prevent. Using sequential-thinking alone skips the scout and leaves you without a regression test. |
| Starting with `meow:investigate` then separately running `meow:fix` | `meow:fix` only | `meow:fix` Step 2 already invokes investigate. Running them separately duplicates work and produces two DEBUG REPORTs. |
| Stacking `meow:problem-solving` + `meow:sequential-thinking` in one prompt | Pick ONE — based on whether you're stuck on approach or cause | Claude Code has no chain operator. Stacking just sends the second skill name as arguments to the first. |
| Starting with `/meow:fix` for "design this from scratch" | `meow:plan-creator` or `meow:brainstorming` | `meow:fix` is for broken things. Green-field design is a different axis entirely. |

## Hand-offs Between Skills

Once started, a skill may hand off. These hand-offs are **real** (coded into the SKILL.md files), not suggestions:

```mermaid
flowchart LR
    FIX[meow:fix] -->|Step 2 internal call| INV[meow:investigate]
    INV -->|Phase 3 internal call| SEQ[meow:sequential-thinking]
    FIX -->|Step 2 internal call| SEQ
    FIX -->|Conditional Step 2.5| BRAIN[meow:brainstorming]
    FIX -->|Conditional| DOCS[meow:docs-finder]

    PS[meow:problem-solving] -.->|boundary reroute<br/>if code broken| SEQ
    PS -.->|boundary reroute<br/>if multi-perspective| PARTY[meow:party]

    style FIX fill:#4a90e2,color:#fff
    style INV fill:#27ae60,color:#fff
    style SEQ fill:#9b59b6,color:#fff
    style PS fill:#f39c12,color:#fff
```

## Anti-Patterns

From the `Gotchas` sections of each SKILL.md:

- **Guessing root causes** — "I think it's X" without evidence. Fix: let `meow:sequential-thinking` enforce evidence.
- **Fixing symptoms** — test passes but underlying issue remains. Fix: trace backward, symptom → cause → ROOT cause.
- **Skipping scout** — diagnosing without codebase context. `meow:fix` Step 1 is MANDATORY, not optional.
- **No regression test** — bug resurfaces next sprint. `meow:fix` Step 5 BLOCKs without one.
- **3+ failed fix attempts** — insanity loop. Both `meow:fix` and `meow:investigate` STOP at 3; time to question the architecture with the user.
- **Debugging misroute to problem-solving** — "my code is broken" is not problem-solving territory. Route to `meow:sequential-thinking` or `meow:fix`.
- **Tool-stacking in problem-solving** — running 3 techniques at once hides which one worked. One at a time.

## See Also

- [`meow:fix`](/reference/skills/fix) — full reference
- [`meow:investigate`](/reference/skills/investigate) — full reference
- [`meow:sequential-thinking`](/reference/skills/sequential-thinking) — full reference
- [`meow:problem-solving`](/reference/skills/problem-solving) — full reference
- [Agent-Skill Architecture](/guide/agent-skill-architecture) — how agents compose skills
- [Workflow Phases](/guide/workflow-phases) — where each skill sits in the 7-phase pipeline
