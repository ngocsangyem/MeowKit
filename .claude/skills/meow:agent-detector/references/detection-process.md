# Detection Process

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

**Apply patterns from:** `task-based-agent-selection.md`

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
# 1. Check detection first (fast path):
.claude/project-contexts/[project-name]/project-detection.json

# 2. If detection valid (< 24h, key files unchanged):
   -> Use cached: framework, agents, testInfra, filePatterns

# 3. If detection invalid or missing:
   -> Run full detection (reads package.json, etc.)
   -> Save to project-contexts for next task

# 4. Load project-specific overrides:
.claude/project-contexts/[project]/project-config.yaml
.claude/project-contexts/[project]/conventions.md
```

**Detection invalidation triggers:**
- Key config files changed (package.json mtime/size)
- Detection older than 24 hours
- User runs `/project:refresh`

**Commands:**
- `/project:status` - Show project detection
- `/project:refresh` - Force fresh scan

## Step 3: Score All Agents (Combine Task + Repo)
```
mobile:
  - "iOS" keyword: +35 (semantic)
  - CWD = /mobile-app: +40 (context)
  - Recent *.phone.tsx: +20 (file pattern)
  -> Total: 95 pts PRIMARY

tester:
  - Bug fix intent: +35 (secondary for bugs)
  -> Total: 35 pts OPTIONAL

frontend:
  - "button" keyword: +20 (UI element)
  -> Total: 20 pts NOT SELECTED
```

## Step 4: Select Agents
- Primary: Highest score >=80
- Secondary: Score 50-79
- Optional: Score 30-49

## Step 5: Show Banner

**See:** `rules/core/agent-identification-banner.md` for official format.

**Single Agent Banner:**
```
⚡ AURA FROG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ Agent: [agent-name] │ Phase: [phase] - [name]          ┃
┃ Model: [model] │ [aura-message]                      ┃
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Multi-Agent Banner (when collaboration needed):**
```
⚡ AURA FROG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ Agents: [primary] + [secondary], [tertiary]            ┃
┃ Phase: [phase] - [name] │ [aura-message]            ┃
┃ Model: [model]                                         ┃
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
