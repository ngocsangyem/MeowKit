---
name: meow:agent-detector
description: "CRITICAL: MUST run for EVERY message. Detects agent, complexity, AND model automatically. Always runs FIRST."
autoInvoke: true
priority: highest
model: haiku
triggers:
  - "every message"
  - "always first"
allowed-tools: NONE
# TOKEN OPTIMIZATION: Disabled file scanning tools. Detection uses in-memory patterns only.
# This saves ~10-30k tokens per message. If file scanning needed, use meow:scout explicitly.
source: aura-frog
---

# MeowKit Agent Detector

**Priority:** HIGHEST - Runs FIRST for every message. Automatically detects the correct agent, task complexity level, and model tier for each user message using a multi-layer scoring system. No manual agent selection needed -- the detector analyzes task content, explicit technology mentions, user intent, project context, and file patterns to route to the right agent with the right model.

## When to Use

**ALWAYS** - Every user message, no exceptions. This skill fires before any other skill or agent action. It determines who handles the task, at what complexity level, and with which model.

## Workflow

1. **Check cache** -- reuse cached result if same workflow and phase > 1. See `references/detection-process.md`
2. **Score agents** -- analyze task content, extract keywords, check project context across all layers (0-4). See `references/multi-layer-detection.md`, `references/scoring-and-thresholds.md`
3. **Select model + mode** -- map complexity to model tier, check team mode eligibility. See `references/model-selection.md`, `references/complexity-detection.md`, `references/team-mode.md`
4. **Output + hand off** -- show detection banner, load agent instructions, invoke skill. See `references/detection-process.md`, `references/after-detection.md`

## References

- `references/complexity-detection.md` -- Complexity levels, auto-detection criteria, detection logic
- `references/model-selection.md` -- Model mapping tables (complexity, task type, agent defaults)
- `references/multi-layer-detection.md` -- Layers 0-4: task content, tech, intent, project context, file patterns
- `references/scoring-and-thresholds.md` -- Scoring weights, agent thresholds, QA activation rules
- `references/detection-process.md` -- Step-by-step process (cache, Steps 0-5, banner format)
- `references/examples.md` -- Seven worked examples covering common detection scenarios
- `references/team-mode.md` -- Team mode gate, composition rules, output format, handoff
- `references/after-detection.md` -- Post-detection actions, available agents, manual override

## Token Budget

After complexity detection, check user depth signals per `references/token-budget-levels.md` to set response verbosity. Silent by default — do not surface to users.

## Gotchas

- **Misrouting trivial tasks to heavyweight agents**: Short messages that contain domain keywords (e.g., "fix the auth token") score high for complex agents even when the actual work is a one-line change. The detector favors keyword matches over scope signals. → If the banner shows an unexpected agent/model tier, override via `--quick` or use the explicit `/meow:fix --quick` shorthand to force the right complexity level.
- **Cache stale after context switch**: The detection cache reuses the result from the previous workflow phase, but when a conversation pivots mid-session (e.g., "actually, let's do X instead"), the cached detection is wrong for the new task. The detector doesn't invalidate on pivot signals. → Confirm the banner after any explicit task change; if the agent/model is wrong, start a new message explicitly describing the new task so Layer 0 re-detects from scratch.
- **Multi-domain tasks picking the wrong primary agent**: Tasks spanning two domains (e.g., "add a security check to the payment UI") split scores across agents and the highest scorer wins, which may be wrong for the dominant concern. The tiebreaker is the first keyword match, not importance. → For cross-domain tasks, state the primary concern explicitly at the start of the message (e.g., "Security task: ...") so Layer 0 domain detection anchors to the right agent before keyword scoring runs.
