---
source: new (adapted from gstack ETHOS.md "Search Before Building" principle)
original_file: n/a
adapted: no
adaptation_notes: >
  3-layer knowledge framework adapted into MeowKit imperative rules.
  Added MeowKit agent routing (researcher agent).
  Added "Eureka moment" pattern for documenting first-principles insights.
---

# Search Before Building Rules

Before building anything involving unfamiliar patterns, infrastructure, or runtime
capabilities, ALWAYS search first. The cost of checking is near-zero. The cost of
not checking is reinventing something worse.

## Rule 1: Three Layers of Knowledge

When approaching any implementation, identify which knowledge layer applies:

**Layer 1 — Tried and true.** Standard patterns, battle-tested approaches.
ALWAYS check if the runtime, framework, or language already provides this.
WHY: Rolling a custom solution when a built-in exists is the most common waste.

**Layer 2 — New and popular.** Current best practices, ecosystem trends.
ALWAYS search for these. But scrutinize what you find — popularity is not correctness.
WHY: Blog posts can be wrong. Stack Overflow answers can be outdated. Cross-reference.

**Layer 3 — First principles.** Original observations from reasoning about the specific problem.
These are the most valuable. When you find a genuine insight that contradicts conventional
wisdom, document it explicitly.
WHY: The best solutions come from understanding WHY the conventional approach exists,
then identifying when its assumptions don't hold.

## Rule 2: Search Before Every Unfamiliar Pattern

ALWAYS search before:

- Introducing a new library, package, or dependency
- Implementing a pattern you haven't used in this codebase before
- Solving a problem you haven't encountered before
- Making an architectural decision with long-term consequences

Search means: check existing codebase (Grep/Glob) → check official docs (WebSearch) → check community patterns.

NEVER skip search because "I know how to do this." Even familiar patterns may have better alternatives in the current ecosystem.

## Rule 3: Use the Researcher Agent

For non-trivial research (evaluating libraries, comparing approaches, understanding best practices):

- Route to the **researcher** agent instead of doing inline research
- Researcher returns structured findings with confidence levels
- This keeps research context isolated from the implementation context

WHY: Research produces high-volume, low-signal output that pollutes the main context window.
Subagent isolation preserves attention for implementation.

## Rule 4: Document Eureka Moments

When Layer 3 reasoning reveals a genuine insight — something that contradicts the conventional approach with evidence:

- Name it: "EUREKA: Everyone does X because they assume [assumption]. But [evidence] suggests that's wrong here."
- Log it in `.claude/memory/lessons.md` for future sessions
- This is the highest-value output of the search process

WHY: First-principles insights are rare and valuable. If not documented, they're lost when context resets.
