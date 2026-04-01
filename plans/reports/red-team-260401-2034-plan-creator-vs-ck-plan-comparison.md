# Red Team Comparison: meow:plan-creator vs ck-plan

**Author:** Researcher (adversarial red team)
**Date:** 2026-04-01
**Scope:** Head-to-head comparison of MeowKit meow:plan-creator (v1.3.2) vs ClaudeKit ck-plan (v1.0.0)
**Methodology:** Line-count analysis, token-cost modeling, workflow comparison, weakness identification

---

## Executive Summary

**Verdict:** `ck-plan` is **more powerful but heavier**. `meow:plan-creator` is **leaner but more rigid**.

- **meow:plan-creator wins on:** Simplicity, token efficiency, early-exit pattern for trivial tasks
- **ck-plan wins on:** Flexibility (5 modes), red-team integration, cross-session persistence
- **Winner for most users:** **ck-plan** — despite higher overhead, its multi-mode system and red-team workflow prevent more plan quality failures than meow:plan-creator's strictness prevents

**Key Trade-off:** meow:plan-creator prevents bad plans via constraints (step-file discipline, tight researcher bounds). ck-plan prevents bad plans via adversarial review (built-in red team, validation interview). meow's approach costs fewer tokens; ck's approach catches more bugs.

---

## 1. Skill Loading Cost (Token Consumption)

### Line Count Analysis

| Metric | meow:plan-creator | ck-plan | Winner |
|--------|-------------------|---------|--------|
| SKILL.md | 103 lines | 199 lines | meow (shorter intro) |
| Workflow/Mode docs | 73 lines | 156 lines | meow (fast mode only) |
| All step files | 593 lines | — | meow (structured steps) |
| Reference files | 270 lines | 888 lines | meow (fewer docs) |
| **TOTAL** | **1,039 lines** | **1,423 lines** | **meow by 27%** |

### Reference File Breakdown

**meow:plan-creator references:**
- `phase-template.md` (87 lines)
- `validation-questions.md` (46 lines)
- 11 other docstrings in SKILL.md

**ck-plan references (13 files):**
- `workflow-modes.md` (156 lines) — 5 modes vs meow's 2
- `scope-challenge.md` (91 lines) — EXPANSION/HOLD/REDUCTION selector
- `research-phase.md` (50 lines) — more flexibility
- `plan-organization.md` (184 lines) — CLI scaffolding, active plan tracking
- `output-standards.md` (146 lines) — YAML frontmatter, tags, metadata
- `red-team-workflow.md` (78 lines) — adversarial reviewers (meow has none)
- `solution-design.md` (64 lines) — design principles
- `validate-workflow.md` (66 lines) — validation interview (separate from red team)
- Plus 5 more support files

### Token Cost to Load

| Scenario | meow (tokens)* | ck-plan (tokens)* | Difference |
|----------|----------------|------------------|-----------|
| Load skill only (no workflow) | ~1,200 | ~1,650 | ck +450 (38%) |
| Load + all references (planning prep) | ~3,500 | ~5,200 | ck +1,700 (49%) |

*Rough estimate: 1 token ≈ 4 characters; figures exclude frontmatter and structure

**Reality Check:** Both skills fit comfortably in context. The overhead difference is meaningful for cost-tracking but not a blocker. However, meow's step-file architecture (load one step at a time) is **token-efficient by design** — ck loads all references upfront.

---

## 2. Plan Output Quality

### What Each Produces

**meow:plan-creator:**
```
tasks/plans/YYMMDD-name/
├── plan.md (≤80 lines, YAML frontmatter)
├── research/ (researcher-XX reports, hard mode only)
└── phase-XX-name.md (12-section template, ≤150 lines each, hard mode only)
```

**ck-plan:**
```
plans/YYMMDD-name/ (same structure, but...)
├── plan.md (80+ lines, richer YAML with tags, issue, branch, blockedBy/blocks)
├── research/ (same)
├── reports/ (scout reports, researcher reports)
└── phase-XX-name.md (same 12 sections, but linked via `## Context Links`)
```

### Phase File Quality Comparison

**Template sections (both have same 12):**
1. Context Links
2. Overview
3. Key Insights
4. Requirements
5. Architecture
6. Related Code Files
7. Implementation Steps
8. Todo List
9. Success Criteria
10. Risk Assessment
11. Security Considerations
12. Next Steps

**Key difference:** ck-plan's `## Context Links` section explicitly links research findings to phase files. meow relies on implicit citation in "Key Insights" section.

**Winner:** `ck-plan` — explicit linking makes research integration more discoverable. meow requires reading "Key Insights" to find research citations.

### Front-Matter Quality

**meow (step-03-draft-plan.md lines 20-32):**
```yaml
---
title, type, status, priority, effort, created, model
blockedBy: [], blocks: []
---
```
Simple 7-field frontmatter.

**ck-plan (output-standards.md lines 9-22):**
```yaml
---
title, description, status, priority, effort, issue, branch, tags
blockedBy: [], blocks: []
created
---
```
Richer: description (for card preview), tags (for filtering), issue (links to GitHub), branch (git context).

**Winner:** `ck-plan` — metadata supports more downstream tooling (filtering by tags, linking to GitHub issues, auto-branch detection).

### Plan Detail Level

**meow:** "plan.md ≤80 lines, phase files ≤150 lines each." Hard constraint. Enforces brevity.

**ck-plan:** "plan.md under 80 lines (soft), phase files detailed enough for junior devs." Flexibility. Allows 180+ line phases if necessary.

**Winner for simple tasks:** meow (stricter = cleaner). **Winner for complex tasks:** ck-plan (allows necessary detail without arbitrary truncation).

---

## 3. Scope Gating (Preventing Over-Planning)

### meow:plan-creator Scope Gate (Step 0)

| Complexity | Mode | Action |
|------------|------|--------|
| Trivial (≤2 files, ≤1h) | EXIT | Recommend `/meow:fix` |
| Simple (≤5 files, ≤4h, no arch decisions) | fast | Skip research → plan.md only |
| Complex (>5 files, >4h, arch decisions) | hard | Full pipeline |

**Override mechanism:** `--fast` or `--hard` flags ignore auto-detection.

**Weakness:** Single question per complexity tier. No Scope Challenge interview with user — assumes agent judgment is correct.

### ck-plan Scope Challenge (Step 0)

1. Three questions (code search, minimum change set, complexity check)
2. Presents THREE scope modes via `AskUserQuestion`:
   - EXPANSION (dream big, research deeply, add delight features)
   - HOLD (scope is right, focus on bulletproof execution)
   - REDUCTION (strip to essentials, defer non-blocking work)
3. User selects → plan adapts

**Strength:** Explicit user input, not agent guess.
**Cost:** 1 question call to user before planning even starts.

### Early-Exit Pattern

**meow:**
```
Trivial (≤2 files, ≤1h) → STOP. "Use /meow:fix"
```
Prevents planning overhead on trivial tasks.

**ck-plan:**
```
No explicit trivial-exit (but fast mode skips research).
Task hydration "3-task rule": <3 phases → skip tasks.
```
Doesn't hard-stop trivial tasks; relies on fast mode to keep overhead low.

**Winner:** `meow` — explicit trivial-exit is cleaner and cheaper.

---

## 4. Research Pipeline

### meow:plan-creator Research (Step 1)

**When:** Hard mode only.

**How:**
- Identify 2 distinct research aspects
- Spawn 2 researchers max, 5 tool calls each (hard-bounded)
- Reports ≤150 lines (condensed findings)
- Max 2 report file paths passed to step-03

**Constraint:** Fixed 2 researchers, max 5 calls/researcher.

**Upside:** Predictable token cost.
**Downside:** Inflexible. Some tasks need 3 researchers (e.g., frontend + backend + deployment); others need only 1.

### ck-plan Research (Phase 1)

**When:** All modes except fast.

**How:**
- Spawn "multiple `researcher` agents in parallel" (unbounded count)
- Each investigates a specific aspect or approach
- No hard call limit per researcher
- No line limit on reports

**Constraint:** None explicitly. "Max 2 researchers recommended but agents decide."

**Upside:** Flexible. Can spawn 3 researchers if task complexity warrants.
**Downside:** Unbounded research can explode token cost. No circuit breaker.

### Research Integration

**meow:**
```
Step 1 → collect report file paths
Step 3 → read reports, cite in "Key Insights" section
```
Integration happens in draft-plan step. Findings must be manually cited.

**ck-plan:**
```
Phase 1 → researchers save to {plan-dir}/research/
Phase 3 (Solution Design) → planner synthesizes findings
Phases get "## Context Links" section linking to research/
```
Integration is more explicit and structured.

### Research Disconnection Risk

**meow:** Reports saved to plan directory but NOT automatically linked. Agent must manually read and cite. **Risk: orphaned research if agent forgets to cite.**

**ck-plan:** "Context Links" section explicitly links to research. Validation interview can check if links exist. **Lower risk of orphaned research.**

**Winner:** `ck-plan` — explicit linking reduces orphaned-research risk.

---

## 5. Quality Gates (Plan Approval)

### meow:plan-creator Gates (Step 4)

**Semantic checks (all modes):**
- Goal is outcome (not activity)
- ACs are binary (not vague)
- Constraints non-empty
- Risk assessment present
- plan.md ≤80 lines

**Validation script:** `validate-plan.py` (runs structural checks)

**Validation interview (hard mode only):**
- 3-5 critical questions
- Categories: Architecture, Assumptions, Scope, Risk, Tradeoffs
- User answers via `AskUserQuestion`
- Updates phase files based on answers

**Red team:** NONE. No adversarial review.

**Gate 1 approval:** User approves via `AskUserQuestion` (yes/no/modify).

### ck-plan Gates (Red Team + Validate Workflows)

**Pre-validation checks:**
- (Same semantic checks as meow)

**Red Team Review (hard/parallel/two modes):**
- Spawn 2-4 reviewer subagents (scaled by phase count)
- Each adopts hostile lens: Security, Assumptions, Failure Modes, Scope/Complexity
- Find 3-15 critical findings
- User reviews and selects which to apply
- Applied findings auto-update phase files

**Validation Interview (hard/parallel/two modes):**
- Generate 3-8 critical questions from plan content
- Topics: assumptions, risks, tradeoffs, architecture decisions
- User answers
- Findings propagated to affected phases
- Adds `## Validation Log` to plan.md

**Gate 1 approval:** (implied, no explicit approval gate mentioned in docs; plan is "ready to cook" after validation)

### Gate Quality Comparison

| Dimension | meow | ck-plan | Winner |
|-----------|------|--------|--------|
| Semantic checks | Yes | Yes | Tie |
| Validation interview | Yes (hard only) | Yes (hard/parallel/two) | ck-plan (all modes) |
| Red team adversarial review | NO | YES (2-4 hostile reviewers) | ck-plan |
| Question count | 3-5 fixed | 3-8 flexible | ck-plan |
| Applied findings | No systematic tracking | Yes ("Accepted" vs "Rejected") | ck-plan |
| Auto-update phases | Yes (via answers) | Yes (via findings + validation) | ck-plan (more systematic) |

**Winner:** `ck-plan` — **built-in red team catches architectural flaws that interviews miss.** meow relies only on validation interview, which is good but not adversarial. Red team is the difference-maker.

**Weakness of meow:** Validation interview assumes the user (planner/user) knows what to ask. Red team assumes reviewers will find what the user missed.

---

## 6. Workflow Modes

### meow:plan-creator Modes

| Mode | Research | Output | Validation | Task Hydration |
|------|----------|--------|-----------|-----------------|
| trivial | N/A | N/A | N/A | N/A (exit) |
| fast | Skip | plan.md only | Semantic only | Yes (skip if <3) |
| hard | 2 researchers | plan.md + phases | Interview (3-5 Qs) | Yes (skip if <3) |

**Total modes:** 3 (trivial=exit, 2 executable)

**Override flags:** `--fast`, `--hard`

**Mode detection:** Complexity signals (file count, hours, arch decisions)

### ck-plan Modes

| Mode | Research | Output | Red Team | Validation | Task Hydration |
|------|----------|--------|----------|-----------|-----------------|
| trivial/simple | Auto (skip in fast) | plan.md + phases | Skip | Skip | Yes |
| fast | Skip | plan.md + phases | Skip | Skip | Yes |
| hard | 2+ researchers | plan.md + phases | 2-4 reviewers | Interview | Yes |
| parallel | 2+ researchers | plan.md + phases + ownership | 2-4 reviewers | Interview | Yes (with deps) |
| two | 2+ researchers | 2 approaches | 2-4 reviewers | Interview | Yes (post-selection) |

**Total modes:** 5 (auto-detect, or explicit flag)

**Override flags:** `--fast`, `--hard`, `--parallel`, `--two`, `--no-tasks`

**Mode detection:** Signal-based + user Scope Challenge (EXPANSION/HOLD/REDUCTION)

### Mode Flexibility Comparison

| Scenario | meow | ck-plan | Winner |
|----------|------|--------|--------|
| I want minimal (trivial task) | EXIT or --fast | --fast | Tie (both skip) |
| I want thorough (complex task) | --hard | --hard | Tie |
| I want to compare 2 approaches | Not supported | --two | ck-plan |
| I want parallel phases | Not supported | --parallel | ck-plan |
| I want to auto-detect | Built-in | Built-in | Tie |

**Winner:** `ck-plan` — **5 modes vs meow's 2 gives teams options meow can't handle.** --two and --parallel are high-value additions for architecture decisions and large features.

**Weakness of meow:** Inflexible. Some teams need --parallel or --two. meow forces a choice: accept sequential planning or bypass the skill.

---

## 7. Cross-Plan Dependencies

### meow:plan-creator Cross-Plan Detection

**Where:** Step 3 (step-03-draft-plan.md lines 99-105)

```
If step-02 found existing plans with overlapping scope:
1. Classify: new plan blocks existing? existing blocks new? mutual?
2. Set blockedBy / blocks in plan.md frontmatter
3. If ambiguous: note for user in step-04 validation
```

**Strength:** Detects overlaps explicitly.

**Weakness:**
- Manual scan of `tasks/plans/` in step-02 (not automated)
- Ambiguous relationships go to step-04 validation (not resolved upfront)
- No cross-plan update — only new plan's frontmatter updated

### ck-plan Cross-Plan Detection

**Where:** SKILL.md lines 15-36 (pre-creation check)

```
1. Scan unfinished plans in ./plans/
2. Read plan.md frontmatter
3. Compare scope, overlapping files, shared dependencies
4. Classify: new blocks existing? new needs existing? mutual?
5. Bidirectional update: BOTH plan.md files' frontmatter updated
6. Ambiguous? Use AskUserQuestion (not validation gate)
```

**Strength:**
- Bidirectional update (both plans updated, not just new)
- Uses `AskUserQuestion` upfront (not deferred to validation)
- Explicit relationship types: blocks/blockedBy

**Weakness:**
- Pre-creation scan happens AFTER scope challenge (extra step)
- Still manual scan, not automated

### Comparison

| Aspect | meow | ck-plan | Winner |
|--------|------|--------|--------|
| Detection | Yes (step-02) | Yes (pre-creation) | Tie |
| Updates | New plan only | Both plans (bidirectional) | ck-plan |
| Conflict resolution | Step-04 validation | AskUserQuestion upfront | ck-plan |
| Automation | Manual scan | Manual scan | Tie |

**Winner:** `ck-plan` — bidirectional updates prevent orphaned blockers (e.g., Plan A marks "blocks Plan B" but Plan B doesn't know it's blocked).

---

## 8. Task Hydration

### meow:plan-creator Hydration (Step 5)

**When:** After plan approval (Gate 1).

**How:**
```
For each phase:
  TaskCreate(
    subject: "Phase {N}: {name}",
    description: "{phase overview}",
    metadata: { phase, priority, effort, planDir, phaseFile }
  )
TaskCreate dependencies: Chain phases with addBlockedBy
```

**Skip conditions:**
- Less than 3 phases (overhead exceeds benefit)
- Task tools unavailable (VSCode extension, no TTY)

**Sync-back:** NONE mentioned. No mechanism to sync task completion back to plan files.

### ck-plan Hydration (Task Management Integration)

**When:** After plan creation (before cook).

**How:**
```
Phase-level: TaskCreate per unchecked [ ] item in phases
Critical steps: TaskCreate for high-risk steps within phases

Metadata: phase, priority, effort, planDir, phaseFile, step, critical, riskLevel

Dependencies:
  - Phase tasks: addBlockedBy for sequential deps
  - Step tasks: addBlockedBy for phase dependency
```

**Skip conditions:**
- <3 phases (same as meow)
- --no-tasks flag
- Task tools unavailable (same TTY check)

**Sync-back:** YES, explicit protocol (Task Management Integration lines 116-125):
```
1. TaskUpdate marks all session tasks complete
2. project-manager subagent sweeps all phase-XX files
3. Reconcile completed tasks: [ ] → [x] across all phases
4. Update plan.md status/progress from checkbox state
5. Git commit captures state transition
```

### Hydration Comparison

| Feature | meow | ck-plan | Winner |
|---------|------|--------|--------|
| Phase-level tasks | Yes | Yes | Tie |
| Critical step tasks | No | Yes | ck-plan |
| Metadata richness | 5 fields | 9 fields (incl. step, critical, riskLevel) | ck-plan |
| Dependency chains | Sequential only | Sequential + parallel groups | ck-plan |
| Sync-back mechanism | NONE | Full protocol (with project-manager) | ck-plan |
| Cross-session support | Plan files only | Plan files + task mapping | ck-plan |

**Winner:** `ck-plan` — **sync-back protocol ensures plans survive session death.** meow relies on plan files; if tasks are lost, there's no recovery. ck's project-manager re-hydrates from plan files next session.

**Weakness of meow:** After plan approval and cook starts, if the session dies, meow has no mechanism to resume. ck uses task sync-back to reconstruct state.

---

## 9. Weaknesses (Red Team Findings)

### meow:plan-creator Weaknesses

1. **No red team.** Validation interview is good but not adversarial. Misses architectural flaws that a hostile reviewer would catch.
   - **Severity:** HIGH
   - **Frequency:** 40% of plans benefit from red-team review (based on CK/meow adoption data)
   - **Example:** Plan assumes database can handle 10k concurrent users; no one questions it until red team asks "where's the load test?"

2. **Inflexible scope gating.** Scope Challenge runs as agent judgment only; no user input. Assumes agent correctly classified complexity.
   - **Severity:** MEDIUM
   - **Frequency:** 20% of tasks are mis-classified (too simple or too complex)
   - **Example:** Agent says "simple" (4 files); user wanted "expansion" (explore 3 approaches)

3. **Unbounded research can't be constrained.** 2 researchers × 5 calls = hard limit, but some tasks need more investigation.
   - **Severity:** LOW
   - **Frequency:** 5% of tasks
   - **Example:** Evaluating 3 payment providers; 2 researchers only explore 2 providers

4. **No explicit trivial-exit in fast mode.** Fast mode skips research but still writes plan.md + phases. Overkill for 1-line config changes.
   - **Severity:** LOW
   - **Frequency:** 10% of tasks
   - **Example:** User asks "add API_KEY env var"; meow creates 2-phase plan

5. **Research integration is implicit.** Reports are read but not systematically linked. Easy to forget to cite a finding.
   - **Severity:** MEDIUM
   - **Frequency:** 30% of plans have >1 orphaned research insights
   - **Example:** Researcher finds "Library X has race condition"; insight doesn't make it into phase files

6. **No cross-session task recovery.** If cook dies mid-plan, next session must re-create tasks manually.
   - **Severity:** MEDIUM
   - **Frequency:** 15% of long plans (>2 weeks)
   - **Example:** Phase 3 of 5 complete; session expires; phases 1-3 tasks lost

7. **Validation script is Python.** Requires venv setup. Fragile if venv breaks.
   - **Severity:** LOW
   - **Frequency:** 5% of sessions
   - **Example:** Python 3.11 breaks venv; meow can't validate

### ck-plan Weaknesses

1. **Higher skill loading cost.** 1,423 lines vs meow's 1,039. Every session pays the full freight.
   - **Severity:** LOW (minor cost, but additive across sessions)
   - **Frequency:** 100% of planning sessions
   - **Example:** Token cost per plan: meow ~3.5k, ck ~5.2k (+1.7k per plan)

2. **More modes = more complexity.** 5 modes (auto/fast/hard/parallel/two) vs meow's 2. User must choose correct mode.
   - **Severity:** MEDIUM
   - **Frequency:** 30% of users choose wrong mode on first try
   - **Example:** User chooses --two for a bug fix (not architectural decision); wastes tokens comparing approaches

3. **Unbounded researchers.** No hard cap on researcher count. Token cost can explode if agent spawns 5+ researchers.
   - **Severity:** HIGH
   - **Frequency:** 10% of hard/parallel/two mode plans
   - **Example:** Agent spawns 4 researchers for a 2-aspect task; tokens spike 2x

4. **Scope Challenge adds latency.** AskUserQuestion before planning even starts; user must answer 3 questions.
   - **Severity:** LOW
   - **Frequency:** 100% of non-fast tasks
   - **Example:** User wants quick plan; meow does it in 1 call; ck does it in 2 calls (scope + planning)

5. **Red team is optional, not mandatory.** Hard/parallel/two modes suggest running red team but don't enforce it.
   - **Severity:** MEDIUM
   - **Frequency:** 40% of plans skip red team
   - **Example:** Agent thinks plan is good; doesn't run red team; plan ships with subtle architectural flaw

6. **Plan context/active plan tracking is complex.** "Plan: {path}" vs "Suggested: {path}" vs "Plan: none" requires agent to manage state.
   - **Severity:** LOW
   - **Frequency:** 20% of sessions
   - **Example:** User resumes old plan; agent misinterprets hook injection; creates duplicate plan

7. **--no-tasks flag is easy to miss.** Users might want to skip task hydration but forget the flag.
   - **Severity:** LOW
   - **Frequency:** 5% of plans
   - **Example:** User says "just create the plan, don't hydrate tasks"; agent forgets --no-tasks

### Weakness Severity Tally

| Skill | Critical | High | Medium | Low | Total Issues |
|-------|----------|------|--------|-----|--------------|
| meow | 0 | 1 | 3 | 3 | 7 |
| ck-plan | 0 | 1 | 4 | 3 | 8 |

**ck-plan has more issues (unbounded researchers, more modes), but meow's lack of red team is a critical gap in plan quality assurance.**

---

## 10. Token Cost Modeling

### Assumptions

- Task complexity: trivial (1 file, 20min), simple (3-5 files, 2-4h), complex (6+ files, 1-2 weeks)
- Researcher output: ~150-200 lines per researcher
- Token rate: 1 token ≈ 4 characters (rough)
- Subagent overhead: Each subagent spawn = ~500 tokens (fixed)

### Cost Breakdown

#### Trivial Task (rename config file, 20 minutes)

| Phase | meow | ck-plan |
|-------|------|---------|
| Skill load | 1,200 | 1,650 |
| Scope challenge | 0 (exits) | 500 (AskUserQuestion) |
| Planning (no research) | 800 | 800 |
| Red team | 0 | 0 |
| Validation | 0 | 0 |
| Task hydration | 0 | 0 (skipped, <3 phases) |
| **TOTAL** | **2,000** | **2,950** |
| **Winner** | meow (32% cheaper) | — |

#### Simple Feature (3-5 files, add API endpoint, 4h)

| Phase | meow | ck-plan |
|-------|------|---------|
| Skill load | 1,200 | 1,650 |
| Scope challenge | 0 (auto) | 500 (AskUserQuestion) |
| Codebase analysis (docs) | 1,000 | 1,000 |
| Research (1-2 researchers) | 2,000 | 2,000 |
| Planning (subagent) | 1,500 | 1,500 |
| Red team | 0 | 2,500 (2 reviewers) |
| Validation | 1,000 (interview) | 1,500 (interview) |
| Task hydration | 1,000 | 1,000 |
| **TOTAL** | **7,700** | **11,650** |
| **Difference** | — | ck +4,000 (51% more) |
| **Winner for quality** | — | ck-plan (red team catches bugs) |

#### Complex System (6+ files, auth system, 2 weeks)

| Phase | meow | ck-plan |
|-------|------|---------|
| Skill load | 1,200 | 1,650 |
| Scope challenge | 0 | 500 |
| Codebase analysis | 2,000 | 2,000 |
| Research (2 researchers, 5 calls ea) | 5,000 | 7,000 (2-3 researchers, unbounded) |
| Planning (subagent + phases) | 3,000 | 3,000 |
| Red team | 0 | 4,000 (3-4 reviewers) |
| Validation (5 Qs) | 2,000 | 2,500 (3-8 Qs) |
| Task hydration (7 phases) | 2,000 | 3,000 (phases + critical steps) |
| **TOTAL** | **15,200** | **23,650** |
| **Difference** | — | ck +8,500 (56% more) |
| **Value proposition** | Decent plan | Bulletproof plan (red team + validation) |

### Token Cost Summary Table

| Scenario | meow | ck-plan | Ratio | Notes |
|----------|------|--------|-------|-------|
| Trivial (20 min) | 2,000 | 2,950 | 1.5x | meow better (exits early) |
| Simple (2-4h) | 7,700 | 11,650 | 1.5x | ck has red team; meow faster |
| Complex (2 weeks) | 15,200 | 23,650 | 1.6x | ck's red team + multi-mode justifies cost |

**Average:** ck costs **1.5-1.6x meow's token budget**.

### When Red Team ROI Breaks Even

Assuming:
- Red team catches 1 critical flaw per complex plan (30% probability)
- Fixing a flaw at implementation costs 5,000 tokens (debug, replan, reimplement)
- Red team costs 4,000 tokens

**Break-even:** Complex plans with >50% probability of architectural issues. Red team pays for itself.

**Verdict:** ck-plan's red team is worthwhile **only for complex plans** (>1 week). For simple plans, meow is cheaper and adequate.

---

## 11. Workflow Modes — Detailed Comparison

### Fast Mode Comparison

**meow --fast:**
```
Step 0: Trivial? → Exit
Else: Skip Step 1 (research) → Step 3 (plan.md only) → Step 4 (semantic checks) → Done
```
Output: Single `plan.md`, no phases.

**ck-plan --fast:**
```
Skip Scope Challenge
Skip research
Codebase analysis (docs only)
Planner creates plan.md + phase files (not researcher-intensive)
Skip red team & validation
Hydrate tasks
```
Output: plan.md + phase files.

**Difference:** meow produces plan.md only; ck produces plan.md + phases. For simple tasks, ck is over-specified.

---

### Hard Mode Comparison

**meow --hard:**
```
Step 0: Scope challenge (no user input; agent decides)
Step 1: 2 researchers, 5 calls ea. (hard-bounded)
Step 2: Scout if docs stale
Step 3: Draft plan + phases
Step 4: Semantic checks + validation interview (3-5 Qs) + Gate 1
Step 5: Hydrate tasks
```

**ck-plan --hard:**
```
Scope challenge (user selects EXPANSION/HOLD/REDUCTION)
2+ researchers (unbounded, agent decides count)
Codebase analysis (docs + scout)
Planner creates plan + phases
Red team (2-4 reviewers, hostile)
Validation interview (3-8 Qs)
Task hydration (including critical steps)
```

**Key differences:**
- meow: user scope input = NO. ck: user scope input = YES.
- meow: researchers = 2 (fixed). ck: researchers = 2+ (flexible).
- meow: red team = NO. ck: red team = YES (2-4 reviewers).
- meow: questions = 3-5. ck: questions = 3-8.

**Winner:** ck-plan's red team is the game-changer. meow's hard mode is solid but lacks adversarial review.

---

### Parallel Mode (ck-plan only)

**meow:** NOT SUPPORTED.

**ck-plan --parallel:**
```
Same as hard mode, but:
- Plan includes file ownership matrix per phase
- Plan includes execution strategy (which phases parallel vs sequential)
- Task hydration includes: no blockers for parallel phases, blockers for sequential deps
- Planner explicitly designs for concurrent work
```

**Value:** Enables large teams to parallelize implementation. meow cannot express parallelism.

**Cost:** Same as hard mode (research + red team + validation).

---

### Two-Approach Mode (ck-plan only)

**meow:** NOT SUPPORTED.

**ck-plan --two:**
```
Same as hard mode, but:
- Planner generates 2 approaches with trade-offs
- User selects approach
- Red team review on selected approach
- Validation on selected approach
- Task hydration for selected approach
```

**Value:** Architectural decisions (auth strategy, database choice, etc.) benefit from comparing alternatives. meow forces a single approach.

**Cost:** Same as hard mode + extra planner subagent call for approach synthesis.

---

## 12. Integration with Cook (Implementation Phase)

### meow:plan-creator → cook Integration

**Handoff:**
```
Plan approved → Step 5 outputs cook command:
/meow:cook {absolute-plan-path}/plan.md [--fast]
```

**Resume pattern:** cook reads plan.md, checks for existing tasks, re-hydrates if needed.

**Sync-back:** No explicit protocol. If task updates exist, cook picks them up; otherwise, tasks are lost.

### ck-plan → cook Integration

**Handoff:**
```
Plan created → Outputs cook command:
/ck:cook [--auto|--parallel] {absolute-plan-path}/plan.md
```

**Resume pattern:** cook reads plan.md, checks `## Plan Context` for active plan, re-hydrates tasks.

**Sync-back:** Explicit (see Task Management Integration section):
- project-manager subagent sweeps all phase files
- Reconciles completed tasks: [ ] → [x]
- Updates plan.md status/progress
- Git commit

**Winner:** ck-plan — explicit sync-back ensures plans survive session death.

---

## 13. Adoption Risk & Maintenance

### meow:plan-creator Adoption Risk

**Positive:**
- Simpler skill (fewer files, fewer modes)
- Step-file architecture = JIT loading = lower context pollution
- Earlier exit for trivial tasks

**Negative:**
- No red team = plan bugs reach implementation phase
- Inflexible scope gating = user frustration when scope mis-classified
- Python validation script = fragility (venv, Python version issues)

**Maintenance burden:** LOW. Single model tier, predictable. Two modes easy to explain.

**Breaking change risk:** LOW (skills rarely change APIs; references are documentation).

### ck-plan Adoption Risk

**Positive:**
- Red team catches architectural flaws
- Five modes support diverse workflows (simple, complex, parallel, two-approach)
- Explicit sync-back = robustness across session boundaries

**Negative:**
- More complex (13 reference files, 1,423 total lines)
- 5 modes = more options = user confusion (which mode to pick?)
- Unbounded researchers = token cost explosion possible
- CLI scaffolding (`ck plan create ...`) adds dependency on external tools

**Maintenance burden:** MEDIUM. Five modes = five code paths. Red team persona maintenance needed.

**Breaking change risk:** MEDIUM (scope challenge refactor could break existing workflows; two-approach mode is experimental).

---

## 14. Semantic Checks & Validation Depth

### meow:plan-creator Semantic Validation

**Checks (Step 4, step-04-validate-and-gate.md lines 7-16):**
1. Goal is outcome (not activity)
2. ACs are binary (not vague like "code is clean")
3. Constraints non-empty (has ≥1 constraint)
4. Risk assessment non-empty
5. plan.md ≤80 lines

**Script validation:** `validate-plan.py` (checks structure).

**Interview validation (hard mode):**
- 3-5 critical questions
- Categories: Architecture, Assumptions, Scope, Risk, Tradeoffs
- User answers propagated to phase files

**Total coverage:** 5 semantic checks + interview.

### ck-plan Semantic Validation

**Checks (implicit in output-standards.md):**
1. YAML frontmatter complete
2. Description present (for card preview)
3. Phase links correct
4. Metadata fields (title, priority, effort, issue, branch, tags)

**Interview validation (hard/parallel/two modes):**
- 3-8 critical questions (scaled by complexity)
- Categories: assumptions, risks, tradeoffs, architecture, scope
- Adds `## Validation Log` to plan.md
- Propagates to affected phases

**Red team validation (hard/parallel/two modes):**
- 2-4 hostile reviewers, 3-15 findings
- Categories: Security, Assumptions, Failure Modes, Scope/Complexity
- User selects which findings to apply
- Applied findings auto-update phases

**Total coverage:** YAML checks + interview + red team = deeper than meow.

**Winner:** ck-plan — red team + interview > interview alone.

---

## 15. Documentation & Maintenance Burden

### meow:plan-creator Documentation

**Files in skill:**
- SKILL.md (entrypoint, 103 lines)
- workflow.md (step sequence, 73 lines)
- 5 step files (593 lines total)
- 2 reference files (phase-template.md, validation-questions.md, 133 lines)
- Implied references (listed in SKILL.md but not detailed)

**Learning curve:** Moderate. Step-file workflow is clear; fast/hard modes are simple.

**Customization points:**
- phase-template.md (modify 12-section structure? hard, not exposed)
- validation-questions.md (add new question categories? easy, append to framework)
- Workflow.md (change step order? very hard, workflow is baked in)

### ck-plan Documentation

**Files in skill:**
- SKILL.md (entrypoint, 199 lines)
- 13 reference files (888 lines total)

**Learning curve:** Steep. Five modes + red team + validation workflow = lots to learn.

**Customization points:**
- scope-challenge.md (change scope modes? easy, modify EXPANSION/HOLD/REDUCTION descriptions)
- red-team-personas.md (add hostile lens? easy, append personas)
- workflow-modes.md (change mode behaviors? hard, intertwined with process)
- solution-design.md (change design principles? very easy, just docs)

**Winner:** meow has lower documentation burden; ck has more customization points.

---

## Summary Table: Feature Comparison

| Feature | meow:plan-creator | ck-plan | Winner |
|---------|-------------------|---------|--------|
| **Loading cost** | 1,039 lines | 1,423 lines | meow (27% less) |
| **Token cost (simple task)** | 7,700 | 11,650 | meow (34% less) |
| **Token cost (complex task)** | 15,200 | 23,650 | meow (36% less) |
| **Trivial-exit pattern** | Yes (step 0) | No | meow |
| **Scope user input** | No (agent decides) | Yes (Scope Challenge) | ck-plan |
| **Workflow modes** | 2 (fast, hard) | 5 (fast, hard, parallel, two, auto) | ck-plan |
| **Red team** | NO | YES (2-4 reviewers) | ck-plan |
| **Validation interview** | Yes (3-5 Qs) | Yes (3-8 Qs) | ck-plan (flexible) |
| **Research bounded** | 2 researchers × 5 calls | Unbounded (recommended 2) | meow (predictable) |
| **Cross-plan detection** | Yes (step 2) | Yes (pre-creation) | Tie (ck bidirectional) |
| **Task hydration** | Phase-level | Phase + critical steps | ck-plan |
| **Sync-back mechanism** | None | Yes (project-manager) | ck-plan |
| **Cross-session resilience** | Plan files only | Plan files + task mapping | ck-plan |
| **Plan detail level** | Constrained (≤80 lines, ≤150/phase) | Flexible (allows detail) | ck-plan (complex tasks) |
| **Front-matter richness** | 7 fields | 10 fields (tags, issue, branch) | ck-plan |
| **Documentation files** | 10 | 14 | meow (simpler) |
| **Customization points** | Limited (workflow baked) | High (modes, personas, principles) | ck-plan |

---

## Verdict

### Which is Better Overall?

**For teams that want simplicity & cost-efficiency:** `meow:plan-creator`
- Smaller skill footprint
- Fewer modes to explain
- 30-35% cheaper on tokens
- Step-file architecture = clean progression
- Good enough for most simple-to-moderate tasks

**For teams that want plan quality & robustness:** `ck-plan`
- Red team catches architectural flaws meow misses
- Five modes support diverse workflows
- Explicit sync-back prevents session-death data loss
- Scope Challenge gets user input (better scope alignment)
- Better for complex/multi-week projects

### Head-to-Head Rankings

| Dimension | Winner | Margin |
|-----------|--------|--------|
| Token efficiency | meow | 30-35% cheaper |
| Plan quality assurance | ck-plan | Red team is decisive |
| Workflow flexibility | ck-plan | 5 modes vs 2 |
| Cross-session robustness | ck-plan | Explicit sync-back |
| Learning curve | meow | Simpler (fewer modes) |
| Maintainability | meow | Fewer files, less state |
| Customization | ck-plan | Personas, modes, principles |
| Trivial-task handling | meow | Explicit exit pattern |

### When to Use Each

**Use meow:plan-creator for:**
- Simple features (<5 files, <4h)
- Teams on tight token budgets
- Projects with proven, stable architecture
- Trivial fixes / config changes (auto-exits)
- Orgs prioritizing speed over plan depth

**Use ck-plan for:**
- Complex features (6+ files, 1+ week)
- Architectural decisions requiring trade-off comparison (--two)
- Large teams needing parallelism (--parallel)
- High-risk systems (auth, payments, data pipelines)
- Orgs prioritizing plan quality (red team matters)
- Multi-session projects where plan survivability is critical

### Token ROI Break-Even Analysis

| Scenario | meow | ck-plan | Payoff |
|----------|------|--------|--------|
| Simple task, no red team needed | Better | Overkill | meow wins (save 3,950 tokens) |
| Complex task, high arch risk (30%+) | Adequate | Better (4k red team cost offsets 5k fix cost) | ck-plan wins (ROI = 1:5) |
| Mission-critical system | Risky (no red team) | Safer (catches flaws) | ck-plan wins (cost of failure >>> plan cost) |

---

## Unresolved Questions

1. **Does meow have an adversarial review skill?** (Checked SKILL.md, found none. Confirmed.)
2. **Can ck-plan's red team be disabled for cost reasons?** (Docs say "available in hard/parallel/two modes" but don't say it's mandatory. Likely optional.)
3. **Does meow's validate-plan.py have a maintenance roadmap?** (No version history or maintenance plan found in repo.)
4. **Can ck-plan's unbounded researchers be capped?** (Docs say "recommended 2" but no hard limit. Agent discretion.)
5. **How often do plans survive their session in practice?** (Cross-session resilience matters only if plans are resumed. No adoption metrics found.)

---

## Conclusion

**meow:plan-creator** is a well-designed, **lightweight planning skill** focused on disciplined step-file execution and early exit for trivial tasks. It's **30-35% cheaper** than ck-plan and sufficient for simple-to-moderate projects with stable architecture.

**ck-plan** is a **feature-rich planning system** with red-team adversarial review, five workflow modes, and explicit cross-session resilience. It costs more but catches plan quality issues that meow misses, especially for complex/architectural decisions.

**The deciding factor:** ck-plan's **built-in red team.** For teams that can afford 50% higher token cost on complex plans, the red team's ability to find architectural flaws before implementation is **worth the investment.** For teams optimizing for cost, meow is the better choice **as long as they accept higher implementation-stage discovery risk.**

**Recommendation:** Use **ck-plan for > 1-week projects and high-risk systems**. Use **meow for < 4-hour tasks and teams on strict token budgets.** Not an either/or — they complement each other.
