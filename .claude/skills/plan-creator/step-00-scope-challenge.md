# Step 0: Scope Challenge

Assess task complexity, select planning mode, early-exit trivial tasks.

## Instructions

### 0a. Read Institutional Memory (JSON-first)

1. Read `.claude/memory/architecture-decisions.json` **first** — the canonical, schema-validated store of prior architectural decisions and recurring patterns.
2. Fall back to `.claude/memory/architecture-decisions.md` only when the JSON is absent. If both exist and disagree, prefer the JSON and emit a one-line conflict warning (`⚠ architecture-decisions.md has entries not in the JSON — JSON is authoritative; run 'mewkit memory seed-from-md'`). See `.claude/rules/memory-read-rules.md`.
3. If relevant learnings found, note them for inclusion in plan Context section.

Skip ONLY if `.claude/memory/` doesn't exist.

### 0b. Select Workflow Model

Match task type before proceeding:

| Task type | Model | Reference |
|-----------|-------|-----------|
| New functionality, endpoints, UI | feature | references/workflow-models/feature-model.md |
| Broken behavior, bug, failed test | bugfix | references/workflow-models/bugfix-model.md |
| Restructure without behavior change | refactor | references/workflow-models/refactor-model.md |
| Auth/payments, security review | security | references/workflow-models/security-model.md |

### 0c. Scope Assessment

Ask these 3 questions (internally, don't need to ask user):

1. **What already exists?** — Grep/Glob for existing solutions. Don't rebuild.
2. **What's the minimum change?** — Smallest diff that solves the problem.
3. **Is this actually complex?** — Check signals below.

### 0d. Complexity Classification

| Signal | Trivial | Simple | Complex |
|--------|---------|--------|---------|
| File count | ≤ 2 | ≤ 5 | > 5 |
| Estimated hours | ≤ 1h | ≤ 4h | > 4h |
| Arch decisions | None | None | Yes |
| Domain (scale-routing) | low | low/medium | high |
| New abstractions | 0 | ≤ 1 | > 1 |

**Classify as the HIGHEST matching level** (any one signal at complex → complex).

### 0e. Mode Selection

| Complexity | Planning Mode | What Happens |
|------------|--------------|-------------|
| trivial | EXIT | Print: "Task is trivial. Use `/mk:fix`." → STOP |
| simple | fast | Skip research + codebase analysis. Go to step-03. |
| complex | hard | Full pipeline: research → analysis → plan + phases → red team → validation |
| complex + 5+ dirs OR refactor+complex | deep | Hard pipeline + per-phase scouting after step-03 drafts phase files |

**Override:** User can force mode via `--fast`, `--hard`, or `--deep` flag regardless of complexity.

**Auto-detect `--deep`:** If complexity = complex AND (task affects 5+ directories OR workflow_model = refactor), suggest `--deep` via AskUserQuestion. User can accept or stay with `--hard`.

### 0f. User Scope Input (Hard Mode Only)

**Note:** `--parallel` and `--two` flags set `planning_mode` to `parallel`/`two` respectively and internally behave as `--hard` (full research pipeline). Skip mode selection when either flag is explicitly provided.

**Skip if:** `planning_mode = fast` or trivial.

Present scope mode choice via `AskUserQuestion`. Header: "Scope Mode". Question: "How should I approach the scope for this plan?" Single-select. Options (recommended option first when one applies; otherwise leave neutral):

| Option | Recommend When | Why |
|--------|----------------|-----|
| EXPANSION | Task hints at broader product question or unclear boundaries; research budget available | Research deeply, explore alternatives, think big. Up to 7 phases. |
| HOLD | Scope is already concrete and matches a known workflow model | Focus on bulletproof execution. Standard 3-5 phases. |
| REDUCTION | Time-boxed, MVP framing, or single concrete deliverable | Strip to essentials. Defer non-critical work. Minimal 2-3 phases. |

**Scope mode effects:**

| Mode | Research | Phase Count | Constraints |
|------|----------|-------------|-------------|
| EXPANSION | 2 researchers + broader questions | Up to 7 phases | Explore alternatives |
| HOLD | 2 researchers (standard) | Standard (3-5) | Execute within stated scope |
| REDUCTION | 1 researcher (focused) | Minimal (2-3) | Strip to MVP, defer rest |

### 0g. Mode Suggestion Logic (Hard Mode Only)

**Skip if:** `planning_mode = fast`, trivial, or user already provided `--parallel`/`--two` explicitly.

After scope assessment, scan the task description for structural signals:

| Signal | Suggestion |
|--------|-----------|
| Task describes 3+ independent layers or modules (e.g., "DB layer", "API layer", "UI layer") | Suggest `--parallel` |
| Task describes 2 alternatives or "X vs Y" framing (e.g., "monolith vs microservices") | Suggest `--two` |

**If signal detected**, present via AskUserQuestion:

```json
{
  "questions": [{
    "question": "I detected {signal description}. Would you like to use a specialized mode?",
    "header": "Mode Suggestion",
    "options": [
      { "label": "--parallel", "description": "Independent phases run concurrently with file ownership matrix." },
      { "label": "--two", "description": "Generate 2 competing approaches; you select before red-team." },
      { "label": "Continue with --hard", "description": "Standard hard mode, no specialization." }
    ],
    "multiSelect": false
  }]
}
```

User selection overrides auto-detection. Only present if a signal is clearly detected — do not prompt on every hard-mode plan.

### 0g.5 Scout / Brainstorm / Plan Routing

**Skip if:** input is an existing `plan.md` or `phase-*.md` path — the plan already encodes scout output and decisions.

Before committing to plan creation, classify the request:

| Condition | Route |
|---|---|
| Relevant files/tests/contracts are unknown and no feature area is named | Run `mk:scout` first, then resume planning |
| Architecture/tradeoff is undecided, or two credible approaches exist | Route to `mk:brainstorming` before planning |
| Touchpoints and approach are concrete enough to answer the 5-dimension contract | Continue planning directly |
| Both approach and touchpoints are unclear | Refuse to draft implementation phases; ask for scout/brainstorm first |

`--deep` may replace a separate scout only when the task names the feature area and approach clearly enough. It must not be used as a substitute for brainstorming.

### 0h. Product-Level Intent Detection

**Skip if:** user already passed `--fast`, `--parallel`, `--two`, or `--hard` explicitly,
or `task_complexity = trivial`.

**Skip if:** user already passed `--product-level` explicitly — set `planning_mode = product-level` and proceed.

Scan the original task description (case-insensitive) for **product-level intent** signals:

| Signal pattern (POSIX ERE) | Example match |
|---|---|
| `\b(build\|create\|make)([[:space:]]+(me\|us))?[[:space:]]+(a\|an\|the)?[[:space:]]*[A-Za-z]+[[:space:]]*(app\|application\|tool\|platform\|game\|site\|service\|product\|saas\|dashboard\|generator\|maker\|editor\|studio\|store\|marketplace\|engine\|suite)\b` | "build me an app", "build a kanban app", "make a SaaS dashboard", "make a retro game maker" |
| `\b(build\|create\|make)[[:space:]]+(a\|an\|the)[[:space:]]+[A-Z][A-Za-z]{1,8}\b` (bare noun / acronym head) | "create a DAW", "build a CMS", "make a CRM" |
| `\b(green[[:space:]-]?field\|new product\|from scratch\|brand new)\b` | "green-field SaaS", "new product idea" |

**If a signal matches** AND no implementation context exists in the prompt
(no file names, no class names, no "fix the X bug", no "refactor the Y module"):

Present via `AskUserQuestion`. Header: "Plan Mode". Question: "This looks like a green-field product build. Should I produce a product-level spec (user stories, features, design language) or a traditional implementation plan?" Single-select.

| Option | Recommend When | Why |
|--------|----------------|-----|
| Product-Level (Recommended) | Green-field "build a X" prompt with no implementation context AND capable model | Ambitious user-story spec, no file paths. Hands off to harness skill for implementation. |
| Implementation Plan | User actually wants concrete file paths / schemas / step-by-step | Traditional phase-XX file plan. Best for refactors, bug fixes, well-scoped features. |
| Cancel | Prompt is ambiguous and user should clarify | Stops the workflow; user re-issues the prompt with more detail. |

**Effect of selection:**

| Selection | `planning_mode` | Next step |
|---|---|---|
| Product-Level | `product-level` | Skip to step-01 (broader research) → step-02 (LIGHT codebase analysis) → step-03a |
| Implementation Plan | (continue with prior `planning_mode`) | Existing flow |
| Cancel | (exit) | Print "Cancelled. Please clarify the request." → STOP |

**Auto-detection guard:** Do NOT auto-fire if any of these are true:
- Task description contains a file path (e.g., `src/auth.ts`)
- Task description names an existing module/class (e.g., `UserService`)
- Task description starts with `fix`, `refactor`, `update`, `migrate`, `bump`
- `task_complexity = trivial` (use `/mk:fix` instead)

**Note:** `planning_mode = product-level` skips the EXPANSION/HOLD/REDUCTION scope question (it is product-level by definition — ambition is the default).

### 0h-spike. Spike Mode Detection (Agile context)

**Skip if:** user did NOT pass `--spike` AND plan frontmatter does NOT contain `spike: true`.

**If `--spike` flag is present OR frontmatter has `spike: true`:**

1. **Reject incompatible combinations:**
   - `--spike` + `--product-level` → emit "spike incompatible with --product-level" → STOP
   - `--spike` + harness FULL density invocation → emit "spike incompatible with harness FULL — use --fast or mk:cook" → STOP
2. **Require timebox.** If `--timebox <duration>` flag absent (and no `timebox:` in frontmatter) → emit "spike requires --timebox (e.g., --timebox 2d)" → STOP
3. **Set planning_mode = spike.** Override any auto-detected mode
4. **Set frontmatter additions for plan.md:**
   - `spike: true`
   - `timebox: "<duration>"` (from `--timebox` flag)
   - `findings_doc: "tasks/plans/{slug}/findings.md"` (default; user-overridable)
5. **Skip step-01 (research) and step-02 (codebase analysis).** Proceed directly to step-03 with the spike template at `assets/spike-plan-template.md`
6. **Story-points advisory:** if user passed `--story-points N` and N > 5, surface `Spike with story_points={N} > 5 — likely two spikes, or spike + story. Continue?` (advisory only, never blocks)

Spike plans use `assets/spike-plan-template.md` instead of the full phase template. The template defines two phases only: investigate + document findings (NO test, NO ship). Phase 5 is "Findings doc written and reviewed".

### 0i. Composable Flags

**`--tdd` flag detection:**

If `--tdd` is present in the arguments (e.g., `--hard --tdd`), set `tdd_mode = true`. This flag is composable with any planning mode. It does NOT change the planning mode — it adds TDD structure to phase files at step-03.

If `MEOWKIT_TDD=1` env var is set, auto-enable `tdd_mode = true`.

Default: `tdd_mode = false`.

**`--html` flag detection:**

If `--html` is present in the arguments (e.g., `--hard --html`), set `html_mode = true`. This flag is composable with any planning mode. It does NOT change the planning mode — after Gate 1 and task hydration, step-08b renders the approved plan to `plan.html` via `mk:visual-plan`.

`--html` is rejected by the `archive` / `red-team` / `validate` subcommands (those do not produce a plan to render); detection here is the single source of truth for the flag.

Default: `html_mode = false`.

### 0j. Visual Requirement Classification (all modes)

Classify the plan's UI-visibility into `visual_requirement ∈ {required, optional, none}`
with one-sentence reasons. This runs in ALL planning modes including fast
(Validation Session 1 user decision; fast-mode friction accepted — rule table only,
no extended interview). Do NOT reuse `html_mode` (legacy static-export intent).

Quick rule: rendered-UI change / storyboard / state-heavy flow (onboarding, auth,
checkout, permissions) / multiple user-visible branches → `required`. UI touched but
trivial/single control → `optional`. Backend-only / migration / copy-only / refactor /
tooling / docs → `none`.

Full activation table + downstream effects: `references/visual-plan-integration.md` §1.

## Output

- `task_complexity` — trivial, simple, or complex
- `planning_mode` — fast, hard, deep, parallel, two, **product-level**, or **spike** (trivial = exit, no mode)
- `workflow_model` — feature, bugfix, refactor, or security
- `scope_mode` — EXPANSION, HOLD, or REDUCTION (hard mode only; fast = HOLD default; product-level = EXPANSION default; spike skips scope question)
- `tdd_mode` — true or false (composable flag, independent of planning_mode)
- `html_mode` — true or false (composable flag, independent of planning_mode)
- `spike_meta` — `{ timebox, findings_doc, story_points }` when planning_mode = spike; unset otherwise
- `visual_requirement` — `required`, `optional`, or `none` (all modes)
- `visual_reasons` — short bullet list justifying the classification
- Print: `"Scope: {complexity} → mode: {mode} | model: {workflow_model} | scope: {scope_mode} | tdd: {tdd_mode} | html: {html_mode} | visual: {visual_requirement}"`

## Next

If trivial → STOP (recommend /mk:fix).
Otherwise, FIRST read and follow `step-00-5-intake-packet.md` (conditional — activates only when ≥2 external artifact paths are in the invocation; 0–1 sources skip cleanly). It then routes by mode:
If fast → skip to `step-03-draft-plan.md`.
If **spike** → skip step-01 and step-02; go directly to `step-03-draft-plan.md` using `assets/spike-plan-template.md` (gated by `agile-feedback-cycle.md` 2 when Agile context active).
If **product-level** → read and follow `step-01-research.md` (broader: competitors, design trends, AI integration patterns).
If hard, deep, parallel, or two → read and follow `step-01-research.md`.
