# Detection Process


## Contents

- [Pre-Step: Check Detection Cache (Performance Optimization)](#pre-step-check-detection-cache-performance-optimization)
- [Detection Result (cached)](#detection-result-cached)
- [Step 0: Task Content Analysis (Do This First!)](#step-0-task-content-analysis-do-this-first)
- [Step 1: Extract Keywords](#step-1-extract-keywords)
- [Step 2: Check Project Context (Use Cached Detection!)](#step-2-check-project-context-use-cached-detection)
- [Step 3: Score All Agents (Combine Task + Repo)](#step-3-score-all-agents-combine-task-repo)
- [Step 4: Select Agents](#step-4-select-agents)
- [Step 5: Show Banner](#step-5-show-banner)

## Pre-Step: Check Detection Cache (Performance Optimization)

**Before running full detection, check if a cached result can be reused.**

Cache file: `.claude/cache/agent-detection-cache.json`

```toon
cache_check[4]{condition,action}:
  Cache exists AND same workflowId AND phase > 1,Use cached result (skip Steps 0-5)
  Cache exists AND same workflowId AND phase = 1,Invalidate — re-detect (requirements may change agents)
  New workflow OR no workflowId,Invalidate — full detection
  User override (e.g. "Use tester"),Invalidate — honor explicit override
```

**Cache hit output:**

```markdown
## Detection Result (cached)

- **Agent:** [cached-agent]
- **Model:** [cached-model]
- **Complexity:** [cached-complexity]
- **Cache:** hit (workflow: [id], phase: [N])
```

**Cache write:** After completing Steps 0-5, write detection result to cache file:

```json
{
  "workflowId": "FEAT-123",
  "agent": "architect",
  "model": "sonnet",
  "complexity": "Standard",
  "secondary": ["tester"],
  "teamMode": false,
  "detectedAt": "2026-03-24T10:00:00Z"
}
```

**Savings:** ~500-1000 tokens per message after first detection in a workflow.

---

## Step 0: Task Content Analysis (Do This First!)

**Analyze the task itself before checking the repo.**

```
User: "Update the invoice PDF layout - table breaks across pages"

Task Analysis:
- "PDF" -> Frontend task pattern (+50)
- "layout" -> Frontend keyword (+40)
- "table" -> Frontend keyword (+30)
-> Total frontend score: 120 pts -> frontend is PRIMARY

Even if repo is pure backend, frontend leads this task!
```

**Apply patterns from:** `references/multi-layer-detection.md` (Layer 0 — Task Content Analysis)

## Step 1: Extract Keywords

```
User: "Fix the login button not working on iOS"

Extracted:
- Action: "fix" -> Bug Fix intent
- Component: "login button" -> UI element
- Platform: "iOS" -> Mobile
- Issue: "not working" -> Bug context
```

## Step 2: Check Project Context (Use Cached Detection!)

**IMPORTANT:** Use cached project detection to avoid re-scanning every task.

```bash
# 1. Check topic files for cached project context (on-demand reads):
.claude/memory/fixes.md + fixes.json                      # bug-class lessons (mk:fix)
.claude/memory/review-patterns.md + review-patterns.json  # review/architecture patterns
.claude/memory/architecture-decisions.md + *.json         # past architectural decisions

# 2. If context is insufficient:
   -> Run mk:scout for codebase structure
   -> Read package.json, tsconfig.json, etc. directly

# 3. For fresh codebase scan:
   -> Use /mk:scout [target] for parallel directory search
```

## Step 3: Score All Agents (Combine Task + Repo)

```
developer:
  - "iOS" keyword: +35 (semantic — mobile implementation)
  - "fix" keyword: +30 (bug fix intent)
  - Recent *.phone.tsx: +20 (file pattern)
  → Total: 85 pts PRIMARY

tester:
  - Bug fix intent: +35 (secondary for bugs)
  → Total: 35 pts OPTIONAL
```

## Step 4: Select Agents

- Primary: Highest score >=80
- Secondary: Score 50-79
- Optional: Score 30-49

## Step 5: Show Banner

**Single Agent Banner:**

```
⚡ MEOWKIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ Agent: [agent-name] │ Phase: [phase] - [name]          ┃
┃ Model: [model] │ [aura-message]                      ┃
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Multi-Agent Banner (when collaboration needed):**

```
⚡ MEOWKIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ Agents: [primary] + [secondary], [tertiary]            ┃
┃ Phase: [phase] - [name] │ [meow-message]            ┃
┃ Model: [model]                                         ┃
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```