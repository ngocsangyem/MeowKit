# MeowKit Documentation — Audience Definition

> Phase 0.1 deliverable | 2026-05-02
> Determines depth, tone, structure, and navigation for all doc pages.

---

## Audience Personas

### 1. New Users ("First-Time Installer")

**Who:** Developer who heard about MeowKit, wants to try it on their project.
**Primary task:** Install → run first task → see results in <10 minutes.
**Depth needed:** Step-by-step tutorial, linear flow. No architecture deep-dives.
**Frequency:** Once (during onboarding).
**Doc type they need:** Getting Started (linear walkthrough).

**Key questions they ask:**
- What does this do in one sentence?
- How do I install it?
- What's the first command I run?
- What will I see happen?
- How is this different from raw Claude Code?

**Docs they hit:**
- `introduction.md` → `installation.md` → `quick-start.md`

**Anti-pattern:** Showing them the 77-skill reference index. They don't need to know about `mk:chom` yet.

---

### 2. Daily Users ("Task-Driven Developer")

**Who:** Developer using MeowKit daily to build features, fix bugs, review PRs.
**Primary task:** Get a specific task done (build a feature, fix a bug, ship a PR).
**Depth needed:** Quick lookup + copy-paste examples. Command flags, common patterns.
**Frequency:** Daily (multiple times per session).
**Doc type they need:** Reference + Composition Guides (search-first).

**Key questions they ask:**
- What flag do I pass to skip tests? (`--tdd`? no, that enables it...)
- What does the review verdict format look like?
- How do I chain cook → review → ship?
- What's the difference between /mk:cook and /mk:harness?
- How do I fix a bug that's already in production?

**Docs they hit:**
- Composition guides (recipes) — PRIMARY entry point
- Skill reference pages (for specific flags/arguments)
- CLI reference (for command flags)
- Cheatsheet

**Organization principle:** Organize primary nav by TASK (Build, Fix, Review, Ship, Plan), not by component inventory. Each task landing page pulls in relevant skills, agents, and commands.

---

### 3. Skill Authors ("Extending MeowKit")

**Who:** Developer or power user creating custom skills for their team/org.
**Primary task:** Write a new SKILL.md, wire it into the pipeline, test it.
**Depth needed:** Authoring spec, template, security rules, injection guidelines.
**Frequency:** Occasionally (per new skill).
**Doc type they need:** Skill Authoring Guide (structured spec).

**Key questions they ask:**
- What frontmatter fields are required?
- How do I add a step file?
- How do I hook into memory?
- What security rules must I follow?
- How do I test my skill?

**Docs they hit:**
- `skill-creator` reference
- `skill-template-secure` reference
- `skill-authoring-rules.md`
- `injection-rules.md`
- Skill template examples

---

### 4. Maintainers ("Debugging the Harness")

**Who:** MeowKit maintainers debugging hooks, handlers, dispatch, and pipeline behavior.
**Primary task:** Understand why a hook fired/didn't fire, trace state through handlers.
**Depth needed:** Architecture deep-dive. Source-level understanding.
**Frequency:** As needed (during incident/debugging).
**Doc type they need:** System Internals (deep reference).

**Key questions they ask:**
- What's the exact TDD sentinel chain?
- Which handlers run on PostToolUse?
- How does dispatch.cjs parse stdin?
- What state files does gate-enforcement.sh read?
- Why did the budget tracker not fire?

**Docs they hit:**
- `reference/hooks.md`
- `reference/middleware.md`
- `core-concepts/session-state.md`
- `core-concepts/conversation-summary.md`
- Source code (`.claude/hooks/`)

---

## Structure Strategy

```
PRIMARY NAV (task-based, for Daily Users + New Users):
  🏠 Home (index.md)
  🚀 Get Started (introduction → installation → quick-start)
  🔨 Build (cook, harness skills + composition guide)
  🔧 Fix (fix, investigate skills + composition guide)
  ✅ Review (review, evaluate, cso skills + composition guide)
  🚢 Ship (ship, canary skills + composition guide)
  📋 Plan (plan-creator, brainstorming, decision-framework + composition guide)

SECONDARY NAV (reference, for Skill Authors + Maintainers):
  📚 Reference
    ├── Skills (alphabetical, all 77)
    ├── Agents (all 17)
    ├── Commands (all 21)
    ├── Hooks & Middleware
    ├── Configuration
    └── Rules
  📖 Guides (philosophy, workflow phases, model routing, etc.)
  📋 CLI Reference
  🗺️ Workflows (scenario-based)
  📊 Cheatsheet
```

**Priority:** Get Started pages are the funnel. If a new user can't succeed in 10 minutes, they won't become a daily user. Invest the most polish there.
