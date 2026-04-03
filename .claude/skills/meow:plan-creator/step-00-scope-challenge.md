# Step 0: Scope Challenge

Assess task complexity, select planning mode, early-exit trivial tasks.

## Instructions

### 0a. Read Institutional Memory

1. Read `.claude/memory/lessons.md` if exists — note relevant patterns
2. Read `.claude/memory/patterns.json` if exists — filter by scope
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
| trivial | EXIT | Print: "Task is trivial. Use `/meow:fix`." → STOP |
| simple | fast | Skip research + codebase analysis. Go to step-03. |
| complex | hard | Full pipeline: research → analysis → plan + phases → red team → validation |

**Override:** User can force mode via `--fast` or `--hard` flag regardless of complexity.

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

## Output

- `task_complexity` — trivial, simple, or complex
- `planning_mode` — fast, hard, parallel, or two (trivial = exit, no mode)
- `workflow_model` — feature, bugfix, refactor, or security
- `scope_mode` — EXPANSION, HOLD, or REDUCTION (hard mode only; fast = HOLD default)
- Print: `"Scope: {complexity} → mode: {mode} | model: {workflow_model} | scope: {scope_mode}"`

## Next

If trivial → STOP (recommend /meow:fix).
If fast → skip to `step-03-draft-plan.md`.
If hard, parallel, or two → read and follow `step-01-research.md`.
