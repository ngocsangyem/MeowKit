---
title: What's New
description: "MeowKit release notes — latest features, improvements, and changes."
persona: A
---

# What's New

Release notes for each MeowKit version.

## Releases

### [v1.2.0 — The Memory Activation Release](/guide/whats-new/v1.2.0)

Fixed the dormant memory system and enriched it with cross-framework insights.

- **Session capture pipeline fixed:** Stop hook → NEEDS_CAPTURE markers → Phase 0 retroactive capture
- **3-category extraction:** Learnings captured as patterns, decisions, or failures (from Khuym compounding)
- **Enriched schema:** New `category`, `severity`, `applicable_when` fields in patterns.json
- **Consolidation rubric:** 4-branch classification (clear match/ambiguous/no match/no durable signal)
- **Stronger promotion:** Severity + ≥30 min savings required alongside frequency ≥ 3
- **Comprehensive docs:** New `memory-system.md` guide + updated VitePress pages

### [v1.1.0 — The Reasoning Depth Release](/guide/whats-new/v1.1.0)

Deeper review reasoning, resumable builds, and systematic coverage mapping.

- **3 new skills:** `meow:elicit` (structured second-pass reasoning), `meow:validate-plan` (8-dimension plan validation), `meow:nyquist` (test-to-requirement coverage mapping)
- **Enhanced review pipeline:** Scout integration + elicitation hook
- **Beads pattern:** Atomic, resumable work units for COMPLEX builds
- **Subagent Status Protocol:** DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT
- **SKILLS_INDEX.md:** Centralized registry of 60+ skills

### [v1.0.0 — The Disciplined Velocity Release](/guide/whats-new/v1.0.0)

Initial release. 13 capabilities across intelligence, quality, collaboration, and architecture.

- **Scale-adaptive routing:** Domain-based complexity detection at Phase 0
- **Hook enforcement:** Preventive shell hooks upgrade behavioral rules
- **Adversarial review:** 3 parallel reviewers with triage
- **Party mode:** Multi-agent deliberation for architecture decisions
- **Step-file architecture:** JIT-loaded steps with resumability
- **Parallel execution:** Up to 3 agents in isolated worktrees
