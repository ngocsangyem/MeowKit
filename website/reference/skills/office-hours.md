---
title: "mk:office-hours"
description: "YC-style product validation — startup mode (6 forcing questions) and builder mode (design thinking). For 'should we build this?' before any code."
---

# mk:office-hours

YC Office Hours — two modes. Startup mode: six forcing questions that expose demand reality, status quo, narrowest wedge, observation, and future-fit. Builder mode: design thinking for side projects, hackathons, learning, open source. Produces a design doc — not code.

**HARD GATE:** Do NOT invoke any implementation skill, write code, scaffold, or take implementation action. Output is a design document only.

## When to use

- User says "brainstorm this", "I have an idea", "help me think through this", "office hours", "is this worth building"
- User describes a new product idea or is exploring whether something is worth building
- BEFORE a plan exists — for reviewing an existing plan, use `mk:plan-ceo-review`

## Plan-first gate

Office hours IS the planning step: if user has an idea → runs BEFORE plan-creator. Output is a design doc → feeds into `mk:plan-creator` as input. Always skips Gate 1 — it's a pre-planning skill.

## Two modes

| Mode | Behavior |
|---|---|
| Startup | 6 forcing questions: demand reality, status quo, desperate specificity, narrowest wedge, observation, future-fit |
| Builder | Design thinking: enthusiastic collaborator for side projects, hackathons, learning |

## Skill wiring

- Writes: `.claude/memory/architecture-decisions.md` with `##decision:` prefix
