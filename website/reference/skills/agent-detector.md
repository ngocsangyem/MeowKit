---
title: "mk:agent-detector"
description: "mk:agent-detector"
---

## What This Skill Does

`mk:agent-detector` is the highest-priority MeowKit skill that runs first on every user message. It analyzes task content, technology mentions, user intent, project context, and file patterns through a 5-layer scoring system to auto-detect which agent should handle the task, at what complexity level, with which model, and whether team mode is warranted. The output is a detection banner shown at the start of every response.

## When to Use

**ALWAYS** — every user message, no exceptions. This skill fires before any other skill or agent action. It determines who handles the task, at what complexity level, and with which model.

## Core Capabilities

### 5-Layer Detection System

| Layer | Name | What It Checks | Score Range |
|-------|------|---------------|-------------|
| 0 | Task Content Analysis | Task patterns regardless of repo type (e.g., PDF styling in a backend repo) | +50 to +60 |
| 1 | Explicit Technology Detection | Direct tech mentions (React, Go, Laravel, etc.) | +60 |
| 2 | Intent Detection | Action keywords (fix, implement, test, design, audit) | +50 exact / +35 semantic |
| 3 | Project Context Detection | Package files, directory structure, config files | +40 |
| 4 | File Pattern Detection | Recent file names, naming conventions | +20 |

**Key rule:** Layer 0 task content can override repo-based detection. A frontend task in a backend repo routes to the right agent regardless.

### Agent Thresholds

| Level | Score | Role |
|-------|-------|------|
| PRIMARY | >= 80 | Leads the task |
| SECONDARY | 50-79 | Supporting role |
| OPTIONAL | 30-49 | May assist |
| Not Activated | < 30 | Not selected |

### Complexity Auto-Detection

| Level | Criteria | Model | Approach |
|-------|----------|-------|----------|
| Quick | Single file, typo fix, explicit path | Haiku | Direct implementation |
| Standard | 2-5 files, feature add, some unknowns | Sonnet | Scout then implement |
| Deep | 6+ files, architecture, vague scope | Sonnet/Opus | Research + plan + implement |

### Model Selection

| Model | When Used |
|-------|-----------|
| Haiku | Quick tasks, simple queries, orchestration routing, journal-writing |
| Sonnet | Standard implementation, coding, testing, bug fixes, reviews |
| Opus | Architecture design, security audits, complex planning, refactoring |

### QA Agent Conditional Activation

- **tester is SECONDARY** when Intent = Implementation or Bug Fix
- **tester is PRIMARY** when Intent = Testing or user explicitly asks for tests
- **tester is SKIPPED** for pure docs, design discussions, or research-only tasks

### Team Mode Detection

Team mode (parallel Claude Code teammates) only activates when ALL conditions are met:

1. `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is enabled
2. Complexity = Deep
3. 2+ domains each score >= 50
4. Task requires cross-domain collaboration

Team mode costs ~3x tokens; only justified when parallel cross-domain work would take 3x longer sequentially.

### Token Budget Levels

After detection, the skill silently sets response verbosity:

| Level | Budget | Trigger Signal Words |
|-------|--------|---------------------|
| Essential | 25% | "brief", "short", "tldr", "quick" |
| Moderate | 50% | "explain", "how does", "walk me through" |
| Detailed | 75% | "detailed", "thorough", "step by step" |
| Exhaustive | 100% | "exhaustive", "everything", "complete" |

Complexity fallback: TRIVIAL -> Essential, STANDARD -> Moderate, COMPLEX -> Detailed. Security/payment/architecture tasks always start at Detailed.

## Workflow

1. **Pre-Step: Check Cache** — Check `.claude/cache/agent-detection-cache.json`. If same workflow and phase > 1, reuse cached result (saves ~500-1000 tokens). Invalidate on new workflow, phase reset, or user override.

2. **Step 0: Task Content Analysis** — Analyze the actual task, not just the repo. Classify task domain (frontend, backend, database, security, etc.) regardless of the repository's primary language.

3. **Step 1: Extract Keywords** — Extract action keywords ("fix", "implement", "design"), component names, platform mentions, and issue descriptions from the user message.

4. **Step 2: Check Project Context** — Read `.claude/memory/fixes.md`, `review-patterns.md`, `architecture-decisions.md`. If insufficient, run `mk:scout` or read `package.json`/`tsconfig.json` directly.

5. **Step 3: Score All Agents** — Combine task scores and repo scores across all 5 layers. Each agent gets a weighted total.

6. **Step 4: Select Agents** — PRIMARY if >= 80, SECONDARY if 50-79, OPTIONAL if 30-49. Check team mode eligibility if Deep + multi-domain.

7. **Step 5: Show Banner** — Display detection result banner at start of response. Single-agent or multi-agent format depending on collaboration needs.

8. **After Detection** — Load agent instructions from `.claude/agents/[agent-name].md`. Invoke the appropriate skill (mk:cook, mk:fix, mk:investigate, mk:review, mk:cso). Context loaded on demand from `.claude/memory/` topic files.

## Example Prompt

```
User: "Fix the login button not working on iOS"

Detection:
- Layer 0: "button" → frontend task content (+50)
- Layer 1: "iOS" → mobile platform
- Layer 2: "fix", "not working" → Bug Fix intent
- Layer 3: package.json has React → +40
- Layer 4: *.phone.tsx files present → +20

Result:
  Agent: developer (PRIMARY, 85 pts)
  Model: sonnet
  Complexity: Standard
  Secondary: tester (35 pts — bug fix triggers QA)
```

## Common Use Cases

- **Every message** in a MeowKit-enabled project — runs automatically
- **Multi-domain tasks** — user says "add a security check to the payment UI"; detector splits scores and picks the right primary agent
- **Cross-repo tasks** — frontend task in a backend repo; Layer 0 overrides repo-based detection
- **Quick fixes** — "fix typo in README.md line 42" routes to orchestrator with Haiku and bypasses planning

## Pro Tips

- If the banner shows an unexpected agent or model tier, override via `--quick` or use explicit skill shorthands like `/mk:fix --quick`.
- For cross-domain tasks, state the primary concern explicitly at the start (e.g., "Security task: add check to the payment UI") so Layer 0 detection anchors correctly.
- The detection cache does NOT invalidate on pivot signals. After any explicit task change ("actually, let's do X instead"), confirm the banner is correct — if not, start a new message explicitly describing the new task.
- Short messages with domain keywords ("fix the auth token") score high for complex agents even for one-line changes — the detector favors keyword matches over scope signals.