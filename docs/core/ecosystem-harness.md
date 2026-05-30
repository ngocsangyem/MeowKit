# Ecosystem Harness

## Purpose

Describe how MeowKit’s ecosystem integrates Claude Code runtime artifacts (transcripts, plans, todo state, hooks/skills) into a governed developer workflow.

## Mental model

- **Rules** define invariants for prompt engineering, safety, gating, file ownership, and phase contracts.
- **Hooks** enforce safety and approval gates outside the model prompt.
- **Skills** are the operational surface that actually performs work, while obeying rule constraints.
- **Artifacts** (JSONL transcripts, plan markdown, todo state, overlay snapshots) are the primary “data plane” between model execution and visualization/verification.

## Top-level integration points

### 1) Claude Code entry document

- `.qwen/CLAUDE.md` is the canonical workflow description that shapes all agent behavior.

Key characteristics:

- 7-phase workflow contract
- hard gates + approval requirements
- expected evidence + verification artifacts

### 2) Hook orchestration config

- `.claude/meowkit.config.json` wires lifecycle hook chain into the runtime.
- `.claude/settings.json` provides a permissions allowlist that constrains tool execution surfaces.

### 3) Core rule set

Authoritative rules live in `.claude/rules/*`.

Examples of invariants (non-exhaustive):

- prompt injection/data-vs-instructions model
- orchestration routing rules
- agent routing and model selection policy
- development workflow requirements
- skill authoring constraints

## Execution safety model (two-layer enforcement)

1) **Prompt-level invariants**: injection/orchestration rules constrain the model behavior.
2) **Hook-level blocking**: a privacy-block hook prevents reads of sensitive files/patterns and defends against risky network access patterns.

Operational result:

- The system must use the AskUserQuestion approval flow when a blocked read/write is required.

## Data plane: artifacts and how they move

### Plans + todo state

- Plans are written as markdown into phase/todo locations.
- The runtime supports atomic todo toggles and plan snapshots for UI consumption.

### JSONL transcripts

- Claude Code produces JSONL transcript events.
- The `orchviz` runtime watches/tails transcript JSONL files.
- A parser converts raw transcript blocks into typed events.

### Orchestration visualization (orchviz)

- A server exposes SSE streams and snapshot endpoints.
- Plan/overlay endpoints allow the UI to render live execution state.

## Orchestration layer (skills + delegations)

### Routing

- Orchestrators route to either core pipeline agents or domain-hub skills behind separate routing rules.

### Delegation prompts

Delegation prompts are expected to include:

- work context path
- plans path
- reports path
- file ownership boundaries

## Ecosystem tooling

### Doc validation & link enforcement

- CI validates `.claude` → `docs/*` references via an allowlist contract.
- CI runs internal doc reference unit tests.

### Docs build pipeline

- The website/docs tree is built via VitePress.
- Releases verify VitePress build output.

### LLM doc indexes

- `mk:llms` generates `llms.txt` from the docs tree (llmstxt.org compatible).

### Diagram assets

- Static architecture diagrams live under `docs/architecture/diagrams/*`.
- orchviz provides a runtime visualization layer distinct from static images.

## How to extend the harness

1) Add/extend rule contracts in `.claude/rules/*` only when you need a new invariant.
2) Add/extend hooks in `.claude/hooks/*` only when you need enforcement outside prompt flow.
3) Add/extend skills in `.claude/skills/*` only when you need a new operational surface.
4) Update docs under `docs/core` so the ecosystem harness description remains the single “start here” reference.

## Source of truth for core contracts

- `docs/core/meowkit-rules.md`
- `docs/core/meowkit-architecture.md`
- `docs/core/memory-system.md`
- `docs/core/branding-style-guide.md`
