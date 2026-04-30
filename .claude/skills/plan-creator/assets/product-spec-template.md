---
title: [Product name — ambitious, evocative, NOT activity-based]
description: [One-line product pitch for card preview]
type: feature
status: draft
priority: [critical | high | medium | low]
effort: [l | xl]
created: [YYMMDD]
branch: [feature/product-slug]
mode: product-level
model: feature-model
tags: [product-spec]
issue: ""
blockedBy: []
blocks: []
---

<!--
PRODUCT-LEVEL SPEC — NO IMPLEMENTATION DETAILS.

Forbidden in this file:
- File paths, class names, function names
- Database schemas, column definitions, SQL
- Step-by-step code instructions
- Specific library versions or package names
- Line-by-line architecture

Allowed in this file:
- User stories ("As a X, I want Y, so that Z")
- Acceptance criteria (binary, behavior-facing)
- Design language (tone, palette, typography direction)
- High-level tech stack RECOMMENDATION (optional)
- AI integration opportunities

The generator agent will figure out HOW. Your job is WHAT + WHY.
-->

## Product Vision
<!-- 3-5 sentences. What is this product? Who is it for? What outcome does it unlock? Be ambitious. -->
[VISION STATEMENT]

## Target User
<!-- 1-3 sentences. Who experiences the value? -->
[USER PERSONA]

## Features

<!--
HARD MINIMUM: 8 features. Target: 12-20. Under-scoping is the default failure mode — push it.
Each feature MUST have:
- Feature name (noun phrase, evocative)
- 1-2 sentence description (what the user sees/does)
- ≥2 user stories in "As a {role}, I want {action}, so that {outcome}" format
- ≥2 acceptance criteria (binary, behavior-facing, no implementation)
-->

### 1. [Feature Name]

**Description:** [1-2 sentences — what the user sees and does]

**User Stories:**
- As a [role], I want [action], so that [outcome].
- As a [role], I want [action], so that [outcome].

**Acceptance Criteria:**
- [ ] [Binary, behavior-facing check]
- [ ] [Binary, behavior-facing check]

### 2. [Feature Name]

**Description:** [...]

**User Stories:**
- As a [...], I want [...], so that [...].
- As a [...], I want [...], so that [...].

**Acceptance Criteria:**
- [ ] [...]
- [ ] [...]

<!-- Continue numbering 3, 4, 5... up to 20. -->

## Design Language
<!-- Populated by mk:frontend-design and mk:ui-design-system subagent calls (if frontend detected). -->

**Tone:** [e.g., playful+minimal, brutalist-editorial, warm-clinical]
**Palette direction:** [e.g., warm neutrals + one accent, monochrome + neon, earth tones]
**Typography direction:** [e.g., serif headline + sans body, all-mono, display + humanist sans]
**Motion:** [e.g., subtle spring, none, theatrical]
**Inspiration:** [2-4 references — products, eras, artists]

## Tech Stack Recommendation (Optional, High-Level)
<!-- Do NOT specify versions, file structures, or exact libraries. High-level categories only. -->
- **Frontend:** [e.g., modern React framework with file-based routing]
- **Backend:** [e.g., serverless functions OR Node API OR none]
- **Storage:** [e.g., local-first OR Postgres OR object storage]
- **Auth:** [e.g., none OR magic link OR OAuth provider]
- **AI:** [see AI Integration Opportunities]

## AI Integration Opportunities
<!-- Where does an LLM / embedding / vision model unlock a 10x experience, not a 10% one? -->
- [Opportunity 1 — user-visible value, not just "we use AI"]
- [Opportunity 2]
- [Opportunity 3]

## Out of Scope
<!-- Explicit anti-features. What would tempt us but we're saying no to NOW. -->
- [Anti-feature 1 + why deferred]
- [Anti-feature 2 + why deferred]

## Open Questions
<!-- Decisions the generator will have to resolve or escalate. -->
1. [Open question 1]
2. [Open question 2]

## Success Criteria (Product-Level)
<!-- Binary, observable checks at product level. No file-path checks here. -->
- [ ] A new user can [core value action] within [time bound]
- [ ] [N] features from above are live and pass their per-feature ACs
- [ ] Design language is visibly consistent across all screens
- [ ] AI integration produces [observable outcome] on real input

## Handoff

After this spec is approved at Gate 1, hand off to the **harness** skill (NOT directly to developer).
The harness will decompose, negotiate a sprint contract, and drive the generator ⇄ evaluator loop.

## Agent State
<!-- Updated by agent after each significant action -->
Planning phase: draft
Last action: product spec drafted from template
Next action: fill Product Vision and first 8 features
Blockers: none
Validation: pending
Approved by: pending
