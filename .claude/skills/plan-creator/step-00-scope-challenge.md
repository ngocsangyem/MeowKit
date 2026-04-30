# Step 0: Scope Challenge

Assess task complexity, select planning mode, early-exit trivial tasks.

## Instructions

### 0a. Read Institutional Memory

1. Read `.claude/memory/architecture-decisions.md` — prior architectural decisions
2. Read `.claude/memory/architecture-decisions.json` — recurring architectural patterns
3. If relevant learnings found, note them for inclusion in plan Context section

Skip ONLY if memory/ directory doesn't exist.

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

Present scope mode choice via AskUserQuestion:

```json
{
  "questions": [{
    "question": "How should I approach the scope for this plan?",
    "header": "Scope Mode",
    "options": [
      { "label": "EXPANSION", "description": "Research deeply, explore alternatives, think big. Up to 7 phases." },
      { "label": "HOLD", "description": "Scope is right. Focus on bulletproof execution. Standard phases." },
      { "label": "REDUCTION", "description": "Strip to essentials. Defer non-critical work. Minimal phases (2-3)." }
    ],
    "multiSelect": false
  }]
}
```

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

Present via AskUserQuestion:

```json
{
  "questions": [{
    "question": "This looks like a green-field product build. Should I produce a product-level spec (user stories, features, design language) or a traditional implementation plan?",
    "header": "Plan Mode",
    "options": [
      { "label": "Product-Level (Recommended)", "description": "Ambitious user-story spec, no file paths. Hands off to harness skill for implementation. Best for new app/product builds with capable models." },
      { "label": "Implementation Plan", "description": "Traditional phase-XX file plan with file paths, schemas, and step-by-step builds. Best for refactors, bug fixes, and well-scoped features." },
      { "label": "Cancel", "description": "Stop and let me clarify the request." }
    ],
    "multiSelect": false
  }]
}
```

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

### 0i. Composable Flags

**`--tdd` flag detection:**

If `--tdd` is present in the arguments (e.g., `--hard --tdd`), set `tdd_mode = true`. This flag is composable with any planning mode. It does NOT change the planning mode — it adds TDD structure to phase files at step-03.

If `MEOWKIT_TDD=1` env var is set, auto-enable `tdd_mode = true`.

Default: `tdd_mode = false`.

## Output

- `task_complexity` — trivial, simple, or complex
- `planning_mode` — fast, hard, deep, parallel, two, or **product-level** (trivial = exit, no mode)
- `workflow_model` — feature, bugfix, refactor, or security
- `scope_mode` — EXPANSION, HOLD, or REDUCTION (hard mode only; fast = HOLD default; product-level = EXPANSION default)
- `tdd_mode` — true or false (composable flag, independent of planning_mode)
- Print: `"Scope: {complexity} → mode: {mode} | model: {workflow_model} | scope: {scope_mode} | tdd: {tdd_mode}"`

## Next

If trivial → STOP (recommend /mk:fix).
If fast → skip to `step-03-draft-plan.md`.
If **product-level** → read and follow `step-01-research.md` (broader: competitors, design trends, AI integration patterns).
If hard, deep, parallel, or two → read and follow `step-01-research.md`.
