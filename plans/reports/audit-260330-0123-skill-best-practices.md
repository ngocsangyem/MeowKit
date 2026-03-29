# Skill Best Practices Audit — Week 1+2 Skills & Rules

**Date:** 2026-03-30
**Auditor:** code-reviewer
**References:** `docs/research/lessons-build-skill.md`, `docs/research/effective-context-engineering-for-ai-agents.md`

---

## Audit Matrix

Criteria key:
- **(1)** Don't State the Obvious
- **(2)** Build a Gotchas Section
- **(3)** Use the File System & Progressive Disclosure
- **(4)** Avoid Railroading Claude
- **(5)** Think through the Setup
- **(6)** Description Field Is For the Model
- **(7)** Memory & Storing Data
- **(8)** Store Scripts & Generate Code
- **(9)** Smallest possible set of high-signal tokens
- **(10)** Progressive disclosure (JIT loading)
- **(11)** Right altitude
- **(12)** Tool efficiency

---

## 1. meow:scale-routing (SKILL.md + data/domain-complexity.csv)

| # | Criterion | Grade | Finding |
|---|-----------|-------|---------|
| 1 | Don't State Obvious | **PASS** | Focuses on domain-specific routing logic Claude cannot infer. CSV data is genuinely non-obvious. |
| 2 | Gotchas Section | **NEEDS_WORK** | No gotchas section. Gotchas needed: (a) CSV keyword matching is substring-based -- "game" matches "gamebook" (false positive); (b) multiple domain matches (fintech + healthcare) have no tiebreak rule; (c) empty/ambiguous task descriptions return "unknown" silently. |
| 3 | File System & Progressive Disclosure | **PASS** | Good use of `data/domain-complexity.csv` as external data file. SKILL.md describes schema, CSV holds actual data. |
| 4 | Avoid Railroading | **PASS** | Describes purpose and routing table without prescribing exact implementation steps. Orchestrator decides how to invoke. |
| 5 | Setup | **PASS** | No first-run setup needed. CSV is pre-populated. Users extend by adding rows. |
| 6 | Description Field | **PASS** | Description reads as a trigger: "Domain-aware complexity routing. Scans task description..." -- model knows when to activate. |
| 7 | Memory & Storing Data | **NEEDS_WORK** | No history tracking. Routing decisions are ephemeral. Suggestion: log routing decisions to `session-state/routing-log.json` so orchestrator can audit false-positive patterns over time. |
| 8 | Scripts | **PASS** | N/A -- simple CSV lookup, no scripts needed. |
| 9 | Lean tokens | **PASS** | 65 lines. Tight. |
| 10 | JIT loading | **PASS** | CSV loaded only when skill invoked at Phase 0. |
| 11 | Right altitude | **PASS** | Describes WHAT and WHY without dictating HOW to parse CSV. |
| 12 | Tool efficiency | **PASS** | N/A -- no tools declared (internal routing skill). |

**Overall: PASS (2 informational items)**

---

## 2. meow:project-context (SKILL.md + templates/project-context-template.md)

| # | Criterion | Grade | Finding |
|---|-----------|-------|---------|
| 1 | Don't State Obvious | **PASS** | Excellent -- "Focus on the Unobvious" section explicitly tells Claude to capture WHY, rejected alternatives, anti-patterns. This is exactly what the best-practices doc recommends. |
| 2 | Gotchas Section | **NEEDS_WORK** | No gotchas section. Needed: (a) `update` action may overwrite manual edits outside `<!-- manual -->` markers; (b) scan targets assume specific config file names -- monorepos with custom layouts will miss files; (c) `.env.example` scan grabs names only but misses multi-stage envs (`.env.production`, `.env.staging`). |
| 3 | File System & Progressive Disclosure | **PASS** | Template in `templates/` folder, SKILL.md describes behavior. Clean separation. |
| 4 | Avoid Railroading | **PASS** | Lists scan targets and template but leaves Claude to decide how to analyze and fill sections. |
| 5 | Setup | **PASS** | Two actions: `generate` for first run, `update` for ongoing. `argument-hint` guides usage. |
| 6 | Description Field | **PASS** | "Generate or update docs/project-context.md" -- clear trigger. |
| 7 | Memory & Storing Data | **PASS** | Output IS the stored data (`docs/project-context.md`). Manual sections preserved on update. |
| 8 | Scripts | **NEEDS_WORK** | Could benefit from a helper script that runs the scan deterministically (grep for package.json, tsconfig, etc.) instead of relying on Claude to do it ad-hoc each time. Would improve consistency across invocations. |
| 9 | Lean tokens | **PASS** | 67 lines. Concise. |
| 10 | JIT loading | **PASS** | Template loaded only when generating. |
| 11 | Right altitude | **PASS** | Good balance. |
| 12 | Tool efficiency | **PASS** | N/A -- no tools declared. |

**Overall: PASS (2 informational items)**

---

## 3. meow:review (SKILL.md + workflow.md + step-01 through step-04 + prompts)

| # | Criterion | Grade | Finding |
|---|-----------|-------|---------|
| 1 | Don't State Obvious | **PASS** | The 3-layer adversarial architecture (Blind Hunter, Edge Case Hunter, Criteria Auditor) is genuinely novel. Not something Claude would do by default. |
| 2 | Gotchas Section | **PASS** | Has explicit gotchas at bottom of SKILL.md: "reviewing diff without full context" and "style nits hiding real bugs." Could add more but the foundation is there. |
| 3 | File System & Progressive Disclosure | **PASS** | Excellent use of step-file architecture. SKILL.md is metadata + overview. workflow.md defines sequence. Step files loaded JIT. Prompts in `prompts/` folder. References in `references/` folder. This is textbook progressive disclosure. |
| 4 | Avoid Railroading | **NEEDS_WORK** | Step files are appropriately structured (WHAT to do, not HOW), but `step-01-gather-context.md` has a mildly prescriptive numbered list ("1. Load the diff... 2. Load the plan..."). Not egregious since these are discrete data-gathering actions, but the ordering is unnecessary -- Claude can gather context in any order. |
| 5 | Setup | **PASS** | No setup needed. Auto-detects input mode from arguments. |
| 6 | Description Field | **PASS** | Multi-line description with explicit trigger phrases: "review this PR", "code review", "pre-landing review", "check my diff", "review #123". Strong. |
| 7 | Memory & Storing Data | **PASS** | `step-03-triage.md` logs incidental findings to `memory/review-backlog.md`. Good persistent state across sessions. |
| 8 | Scripts | **NEEDS_WORK** | No helper scripts. The diff-gathering, file-classification, and security-file detection in step-01 could be a small bash/python script for deterministic results instead of relying on Claude to run the right git commands each time. |
| 9 | Lean tokens | **NEEDS_WORK** | SKILL.md is 140 lines -- the largest of all skills. Contains both the old 2-pass workflow description (lines 72-93 "Workflow" section) AND the new 3-layer adversarial architecture (lines 29-40). The old workflow description (referencing preamble.md, scope-drift-detection.md, etc.) appears to be **legacy content from CK** that overlaps with the new step-file workflow. This creates confusion about which workflow is canonical. |
| 10 | JIT loading | **PASS** | Step files loaded one at a time per step-file-rules.md. Prompts loaded only in step-02. |
| 11 | Right altitude | **PASS** | Prompts are well-pitched: each reviewer gets a clear mandate, categories, severity definitions, and output format without dictating HOW to review. |
| 12 | Tool efficiency | **PASS** | Tool list is reasonable for a review skill (Bash, Read, Edit, Grep, Glob, Agent, AskUserQuestion, WebSearch). |

**Critical finding:** SKILL.md references `checklist.md` and `design-checklist.md` in the References table (lines 94-95), but **neither file exists**. This will cause file-not-found errors at runtime when step-02 tries to load them.

**Overall: NEEDS_WORK (1 critical: missing files; 1 high: legacy content bloat; 2 informational)**

---

## 4. meow:party (SKILL.md + prompts/agent-selector.md + prompts/synthesis.md)

| # | Criterion | Grade | Finding |
|---|-----------|-------|---------|
| 1 | Don't State Obvious | **PASS** | Multi-agent deliberation with structured rounds is not default Claude behavior. The token budget ceiling (8K) and round limits are genuinely useful constraints. |
| 2 | Gotchas Section | **NEEDS_WORK** | No gotchas section. Needed: (a) agents are simulated personas in a single context, not actual parallel subagents -- round quality degrades as context fills; (b) "decide" shortcut can skip important dissent if used prematurely; (c) 150-token limit per response means complex topics get superficial treatment. |
| 3 | File System & Progressive Disclosure | **PASS** | Prompts in `prompts/` folder. SKILL.md covers protocol. Clean split. |
| 4 | Avoid Railroading | **PASS** | Describes round structure but leaves agent responses open-ended. User can interject or skip. |
| 5 | Setup | **PASS** | No setup needed. Topic and optional `--agents` flag is sufficient. |
| 6 | Description Field | **PASS** | Good trigger phrases: "should we X or Y?", "let's discuss", "design review", "retro". |
| 7 | Memory & Storing Data | **NEEDS_WORK** | Party decisions are ephemeral. After the session, the decision summary is lost. Should persist to `memory/decisions.md` or `tasks/decisions/` as recommended by CLAUDE.md's memory section. |
| 8 | Scripts | **PASS** | N/A -- discussion skill, no scripts needed. |
| 9 | Lean tokens | **PASS** | 102 lines. Acceptable. |
| 10 | JIT loading | **PASS** | Prompts loaded when needed (agent selection at start, synthesis at end). |
| 11 | Right altitude | **PASS** | Good balance between structure (round format) and flexibility (open responses). |
| 12 | Tool efficiency | **PASS** | Minimal tools: Read, Grep, Glob, Bash, AskUserQuestion. No Write/Edit since it's discussion-only. Correct. |

**Overall: NEEDS_WORK (1 high: no decision persistence; 2 informational)**

---

## 5. meow:worktree (SKILL.md)

| # | Criterion | Grade | Finding |
|---|-----------|-------|---------|
| 1 | Don't State Obvious | **NEEDS_WORK** | The git worktree commands (`git worktree add`, `git worktree remove`) are standard git. Claude already knows these. The value-add is the naming convention (`parallel/{agent-name}-{timestamp}`) and the safety rules. The commands themselves are obvious. |
| 2 | Gotchas Section | **NEEDS_WORK** | Has "Safety Rules" but no "Gotchas" framed as failure modes. Needed: (a) `git worktree remove` fails silently if the worktree has uncommitted changes and `--force` is not used; (b) worktree branches must be unique -- creating a worktree with an existing branch name fails; (c) worktrees share the same `.git` -- running `git gc` in one worktree affects all. |
| 3 | File System & Progressive Disclosure | **PASS** | Single monolithic file, appropriate at 70 lines. |
| 4 | Avoid Railroading | **FAIL** | This is the most prescriptive skill in the set. Each action is an exact bash command to copy-paste. Per the best-practices doc: "Too prescriptive: Step 1: Run git log... Step 2: Run git cherry-pick..." The skill literally gives `git worktree add .worktrees/{agent-name} -b parallel/{agent-name}-{timestamp}` and `git merge parallel/{agent-name}-{timestamp} --no-ff -m "..."`. Claude knows git commands -- tell it WHAT to achieve, not the exact command. |
| 5 | Setup | **PASS** | No setup needed. |
| 6 | Description Field | **PASS** | Good trigger: "Creates isolated worktrees for parallel agents, merges results, and cleans up." |
| 7 | Memory & Storing Data | **NEEDS_WORK** | No tracking of active worktrees. If context resets mid-parallel-execution, active worktrees are orphaned. Should persist worktree state to `session-state/worktrees.json`. |
| 8 | Scripts | **NEEDS_WORK** | Strong candidate for a helper script. A `worktree-manager.sh` that handles create/merge/cleanup/list with proper error handling and state tracking would be more reliable than Claude constructing git commands each time. |
| 9 | Lean tokens | **PASS** | 70 lines. Fine. |
| 10 | JIT loading | **PASS** | Monolithic, appropriate for size. |
| 11 | Right altitude | **FAIL** | Too low altitude. Prescribes exact commands instead of intent. See (4). |
| 12 | Tool efficiency | **PASS** | No tools declared (uses Bash implicitly). |

**Overall: NEEDS_WORK (2 high: railroading + altitude; 2 informational)**

---

## 6. meow:task-queue (SKILL.md)

| # | Criterion | Grade | Finding |
|---|-----------|-------|---------|
| 1 | Don't State Obvious | **PASS** | Task claiming protocol with ownership enforcement via glob patterns is non-obvious. |
| 2 | Gotchas Section | **NEEDS_WORK** | No gotchas. Needed: (a) glob patterns can overlap non-obviously (`src/api/*` and `src/api/routes/*` both match `src/api/routes/user.ts`); (b) JSON state file is not atomic -- two agents claiming simultaneously could race; (c) `blocked_by` only checks task IDs, not whether the blocking task's output files exist. |
| 3 | File System & Progressive Disclosure | **PASS** | Monolithic at 74 lines, appropriate. JSON schema inline is fine at this size. |
| 4 | Avoid Railroading | **PASS** | Describes the protocol and rules, not step-by-step commands. |
| 5 | Setup | **NEEDS_WORK** | No mention of who creates `session-state/task-queue.json` or what happens if it doesn't exist. SKILL.md says "Orchestrator creates the task queue" but doesn't describe the creation flow or provide a template. First-run behavior is undefined. |
| 6 | Description Field | **PASS** | Clear trigger: "Task claiming and ownership tracking for parallel agent execution." |
| 7 | Memory & Storing Data | **PASS** | Uses `session-state/task-queue.json` for persistent state. Correctly notes it's ephemeral per execution. |
| 8 | Scripts | **NEEDS_WORK** | Strong candidate for a helper script. Task claiming, overlap detection, and state updates on a JSON file would be far more reliable as a Python/bash script than Claude editing JSON by hand. Race condition risk (gotcha b) is eliminated if a script handles atomic read-modify-write. |
| 9 | Lean tokens | **PASS** | 74 lines. |
| 10 | JIT loading | **PASS** | Monolithic, appropriate. |
| 11 | Right altitude | **PASS** | Protocol-level description. |
| 12 | Tool efficiency | **PASS** | No tools declared. |

**Overall: NEEDS_WORK (1 high: race condition in JSON state; 1 medium: undefined setup; 1 informational)**

---

## 7. Rules: scale-adaptive-rules.md

| Criterion | Grade | Finding |
|-----------|-------|---------|
| Lean tokens | **PASS** | 39 lines. Very tight. |
| Right altitude | **PASS** | Each rule has WHY + INSTEAD. Follows the rule format convention. |
| Non-obvious | **PASS** | Rule 4 (one-shot Gate 1 bypass) is a nuanced interaction between CSV and gate system. |
| Gotcha gap | **NEEDS_WORK** | No mention of what happens when CSV returns conflicting domains (task matches both "fintech" and "internal_tools"). Priority/tiebreak rule needed. |

**Overall: PASS (1 informational)**

---

## 8. Rules: step-file-rules.md

| Criterion | Grade | Finding |
|-----------|-------|---------|
| Lean tokens | **PASS** | 61 lines. |
| Right altitude | **PASS** | Clear rules with WHY explanations. Rule 5 (monolithic threshold at 150 lines) is a useful heuristic. |
| Non-obvious | **PASS** | Rule 2 (never skip steps) with the rationale "rationalization" framing is strong. |
| Applicability | **PASS** | Correctly scoped: "apply ONLY to skills that have a workflow.md file." |

**Overall: PASS**

---

## 9. Rules: parallel-execution-rules.md

| Criterion | Grade | Finding |
|-----------|-------|---------|
| Lean tokens | **PASS** | 58 lines. |
| Right altitude | **PASS** | Clear, imperative rules with rationale. |
| Non-obvious | **PASS** | Max 3 agent ceiling with token-cost reasoning is practical. |
| Decision table | **PASS** | "When to Parallelize" table at the bottom is excellent -- concrete examples of yes/no decisions. |
| Gotcha gap | **NEEDS_WORK** | No rule for what happens when a parallel agent fails mid-execution. Do other agents continue? Does the merge abort? Rollback strategy undefined. |

**Overall: PASS (1 informational)**

---

## Critical Issues (Must Fix Before Week 3)

### C1. Missing referenced files in meow:review
**Severity: CRITICAL**
SKILL.md references table lists `checklist.md` and `design-checklist.md` but neither file exists in the skill directory. Runtime failure when the review workflow tries to load them.

**Fix:** Either create the files or remove the references from the table.

### C2. Legacy workflow content in meow:review SKILL.md
**Severity: HIGH**
Lines 72-93 describe a 2-pass workflow with `references/preamble.md`, `references/scope-drift-detection.md`, etc. This appears to be the old CK-style workflow that is superseded by the new step-file architecture (workflow.md + step-01 through step-04). Having both creates ambiguity about which workflow is canonical.

**Fix:** Remove or clearly deprecate the old workflow section. The step-file workflow in workflow.md should be the single source of truth.

### C3. meow:worktree is too prescriptive (railroading)
**Severity: HIGH**
Violates "Avoid Railroading Claude" by providing exact bash commands to copy-paste. Per the reference doc: "Too prescriptive: Step 1: Run git log... Step 2: Run git cherry-pick..."

**Fix:** Rewrite to describe intent + naming convention + safety rules. Remove the code-block commands. Example: "Create an isolated worktree for the agent on a branch named `parallel/{agent-name}-{timestamp}`, branching from current feature branch HEAD."

### C4. Race condition in meow:task-queue JSON state
**Severity: HIGH**
Two agents claiming tasks simultaneously could both read `task-queue.json`, see the same task as `pending`, and both claim it. No atomic operation or locking mechanism.

**Fix:** Add a helper script (`claim-task.py`) that performs atomic read-modify-write with file locking. Or document that orchestrator serializes claims (never parallel claims).

---

## High-Priority Items (Should Fix Before Week 3)

### H1. No gotchas in 4 of 6 skills
Skills missing gotchas: scale-routing, project-context, party, worktree. The reference doc calls gotchas "the highest-signal content in any skill." These should be added iteratively as failure modes are discovered.

### H2. meow:party decisions are ephemeral
Party mode produces decision summaries that vanish after the session. CLAUDE.md already has `memory/decisions.md` for this purpose. Party synthesis should auto-append decisions there.

### H3. meow:task-queue setup undefined
No description of who creates `session-state/task-queue.json`, what the empty-state looks like, or how to bootstrap. Needs a first-run section or template file.

### H4. Helper scripts would improve reliability
`meow:worktree` and `meow:task-queue` both perform stateful operations on the filesystem/git. Helper scripts would make these deterministic instead of relying on Claude to construct commands correctly each time. Priority candidates:
- `scripts/worktree-manager.sh` (create/merge/cleanup with error handling)
- `scripts/task-claim.py` (atomic JSON read-modify-write)

---

## Informational Items (Non-Blocking)

| # | Skill/Rule | Item |
|---|-----------|------|
| I1 | scale-routing | No tiebreak rule for multiple domain matches |
| I2 | scale-routing | No routing decision history/logging |
| I3 | project-context | Scan targets assume conventional config file names; monorepos may miss files |
| I4 | worktree | No persistent worktree state tracking (orphan risk on context reset) |
| I5 | parallel-execution-rules | No failure/rollback strategy for mid-execution agent failure |
| I6 | scale-adaptive-rules | No conflicting-domain priority rule |

---

## Summary Scorecard

| Skill/Rule | Overall | Critical | High | Informational |
|------------|---------|----------|------|---------------|
| meow:scale-routing | PASS | 0 | 0 | 2 |
| meow:project-context | PASS | 0 | 0 | 2 |
| meow:review | **NEEDS_WORK** | **1** | **1** | 1 |
| meow:party | NEEDS_WORK | 0 | **1** | 1 |
| meow:worktree | **NEEDS_WORK** | 0 | **2** | 1 |
| meow:task-queue | **NEEDS_WORK** | 0 | **2** | 0 |
| scale-adaptive-rules | PASS | 0 | 0 | 1 |
| step-file-rules | PASS | 0 | 0 | 0 |
| parallel-execution-rules | PASS | 0 | 0 | 1 |

**Totals:** 1 critical, 6 high, 8 informational across 9 artifacts.

---

## Recommended Fix Priority for Week 3

1. **C1** — Create or remove `checklist.md` and `design-checklist.md` references in meow:review (30 min)
2. **C2** — Clean up legacy workflow content in meow:review SKILL.md (30 min)
3. **C3** — Rewrite meow:worktree to intent-based description (1 hr)
4. **C4** — Add task-claim helper script or document serialized claiming (1-2 hr)
5. **H1** — Add gotchas sections to 4 skills (ongoing, iterative)
6. **H2** — Wire party synthesis to `memory/decisions.md` (30 min)
7. **H3** — Add task-queue setup/bootstrap section (30 min)

---

## Unresolved Questions

1. Is the old 2-pass workflow in meow:review SKILL.md (referencing preamble.md, scope-drift-detection.md, etc.) still in active use alongside the new step-file workflow? Or is it fully superseded?
2. Are `checklist.md` and `design-checklist.md` supposed to be created as part of a later phase, or were they accidentally omitted?
3. For meow:task-queue, is the orchestrator always the sole claim-serializer, or can agents self-claim in parallel?
