# Template Design Principles for AI Agent Tasks & Plans

Extracted from effective context engineering literature. Three critical categories.

## RESUMABILITY
*(Agent picks up mid-task after context reset)*

**P1:** Templates must include self-contained state snapshots; agent cannot assume prior context survives across resets.
Justification: Context windows reset between agent iterations; state must be explicitly encoded in files, not memory.

**P2:** Checkpoint/progress sections should use machine-readable markers (checkboxes, status enums) not prose descriptions.
Justification: Agent can parse `[x] Done` reliably; parsing "we're almost done" introduces ambiguity.

**P3:** Templates must preserve "why" decisions alongside "what" decisions in notes sections.
Justification: Per Anthropic's compaction research, agents need intent/rationale to make good recovery decisions after context reset.

**P4:** Critical dependencies and blockers must be listed separately from task details; agents scan for these first on resumption.
Justification: Prevents wasted context on irrelevant sections when time-constrained after context switch.

**P5:** Include explicit "last successful state" markers (file checksums, commit SHAs, timestamps) not just "last completed step."
Justification: Enables agents to detect stale templates and know exactly what needs re-validation.

---

## AGENT-READABILITY
*(Agents parse & execute reliably)*

**P6:** Lead with **Goal** statement before constraints; agents need intent first to reason about priority trade-offs.
Justification: Anthropic's "right altitude" principle—specify behavior goal, not brittle implementation details.

**P7:** Use numbered sequential lists (1. 2. 3.) for multi-step procedures; bullets for options/alternatives only.
Justification: LLMs execute sequential steps more reliably; bullets invite decision paralysis ("which option do I choose?").

**P8:** Acceptance criteria must be testable, not interpretive; prefer measurable outcomes ("test suite passes") over subjective ("code is clean").
Justification: Prevents agent drift; ambiguous criteria lead to premature task closure.

**P9:** Tools/commands should be copy-paste ready (shell commands in code blocks); agent context budget wasted on tool syntax lookups.
Justification: Reduces tool-use failures and cognitive load; per Anthropic, minimal set of high-signal tokens.

**P10:** Structure: Frontmatter (metadata) → Goal → Context → Steps → Acceptance → Risks → Next. Deviate only with justification.
Justification: Consistent ordering reduces parse failures; agents learn to skim to relevant sections predictably.

**P11:** Explicitly state what agent CANNOT do or must NOT attempt; constraints prevent wasted exploration.
Justification: Prevents agents from exploring dead-ends (attempting force-push, bypassing tests, making breaking changes).

---

## CONTEXT EFFICIENCY
*(Token budget awareness)*

**P12:** Templates should be < 150 lines; longer plans split into phase files with back-references.
Justification: Mirrors Claude Code's hybrid retrieval—drop essential metadata inline, reference phase files just-in-time.

**P13:** Use front-matter YAML for metadata (owner, status, deadline, blockers); agents parse structured data faster than prose.
Justification: Structured data reduces parse attempts; agent skips unnecessary prose sections once it extracts key facts.

**P14:** Link to external docs by path, not inline content; agent retrieves just-in-time if needed.
Justification: Aligns with Anthropic's progressive disclosure principle—keep working context small, pull details on demand.

**P15:** Acceptance criteria and success metrics are required sections; optional sections (risk, rationale) can be deferred.
Justification: Required vs optional prevents agent confusion; optional sections can be retrieved only if agent hits ambiguity.

**P16:** Avoid example/demo outputs in templates unless < 10 lines; use reference paths instead ("see test output in `./reports/`").
Justification: Examples blow context; agents can retrieve exemplars on-demand using tools.

**P17:** Task descriptions should be 50–100 words; detailed context lives in linked docs or code comments, not the template.
Justification: Prevents context rot; minimal focused instruction set empirically outperforms verbose specs per Anthropic research.

**P18:** Use "just-in-time context" pattern: assume agent will `cat`, `grep`, `git log` to find details; template points the way, not exhaustive.
Justification: Matches human cognition—we use file names, paths, timestamps as signals to navigate, not memorize.

**P19:** Include "time budget" estimate and "token estimate" for each task (e.g., "30 min, ~5k tokens"); agent auto-flags risk if oversized.
Justification: Prevents runaway context consumption; agent can escalate before context exhaustion.

**P20:** Templates must include explicit escape hatch: "If this deviates from plan by >X, escalate to lead; don't improvise."
Justification: Prevents agent from hallucinating solutions when blocked; escalation preserves work coherence.

---

## Summary

**Token efficiency:** Metadata + link structure beats inline content.
**Resumability:** Machine-readable state + explicit intent.
**Agent-readability:** Frontmatter → goal → numbered steps → measurable acceptance → next.

*Max 150 lines per template. Reference files for detail. Structured metadata > prose.*
