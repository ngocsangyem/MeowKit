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
# This saves ~10-30k tokens per message. If file scanning needed, use project-context-loader explicitly.
source: aura-frog
author: nguyenthienthanh (aura-frog)
---

# Aura Frog Agent Detector

**Priority:** HIGHEST - Runs FIRST for every message. Automatically detects the correct agent, task complexity level, and model tier for each user message using a multi-layer scoring system. No manual agent selection needed -- the detector analyzes task content, explicit technology mentions, user intent, project context, and file patterns to route to the right agent with the right model.

## When to Use

**ALWAYS** - Every user message, no exceptions. This skill fires before any other skill or agent action. It determines who handles the task, at what complexity level, and with which model.

## Workflow

1. **Check detection cache** -- reuse cached result if same workflow and phase > 1. See `references/detection-process.md`
2. **Analyze task content** (Layer 0) -- detect domain from the task itself, overriding repo type if needed. See `references/multi-layer-detection.md`
3. **Extract keywords and detect intent** (Layers 1-2) -- match explicit technologies and action keywords. See `references/multi-layer-detection.md`
4. **Check project context and file patterns** (Layers 3-4) -- infer tech stack from project files. See `references/multi-layer-detection.md`
5. **Auto-detect complexity** -- classify as Quick, Standard, or Deep based on scope signals. See `references/complexity-detection.md`
6. **Score all agents** -- combine scores from all layers using weighted criteria. See `references/scoring-and-thresholds.md`
7. **Select model** -- map complexity and agent type to haiku/sonnet/opus. See `references/model-selection.md`
8. **Check team mode eligibility** -- Deep + multi-domain tasks may use team mode if enabled. See `references/team-mode.md`
9. **Output detection result and show banner** -- agent, model, complexity, mode. See `references/detection-process.md`
10. **Hand off** -- load agent instructions, invoke appropriate skill, spawn with detected model. See `references/after-detection.md`

## References

- `references/complexity-detection.md` -- Complexity levels, auto-detection criteria, detection logic
- `references/model-selection.md` -- Model mapping tables (complexity, task type, agent defaults)
- `references/multi-layer-detection.md` -- Layers 0-4: task content, tech, intent, project context, file patterns
- `references/scoring-and-thresholds.md` -- Scoring weights, agent thresholds, QA activation rules
- `references/detection-process.md` -- Step-by-step process (cache, Steps 0-5, banner format)
- `references/examples.md` -- Seven worked examples covering common detection scenarios
- `references/team-mode.md` -- Team mode gate, composition rules, output format, handoff
- `references/after-detection.md` -- Post-detection actions, available agents, manual override
