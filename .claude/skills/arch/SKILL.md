---
name: mk:arch
description: "Manages ADRs. NOT for mk:improve-codebase-architecture."
argument-hint: new [title] | list | review [ADR file stem] | impact [change description]
source: local
trust_level: kit-authored
injection_risk: low
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
keywords:
  - adr
  - adr-lifecycle
  - decision-record
  - impact-analysis
  - boundary-review
when_to_use: "A choice needs an ADR."
user-invocable: true
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# Architecture Decision Records

Architecture as a first-class concern. Owns the ADR lifecycle under `docs/architecture/adr/`
and the impact analysis of a proposed change against the decisions already taken.

The `architect` agent authors the decision content; this skill owns the lifecycle — naming,
file layout, status transitions and the impact read. `docs/architecture/` is the architect
agent's directory, so ADR bodies are written by that agent, never by another one.

## Usage

```
mk:arch new [title]
mk:arch list
mk:arch review [ADR file stem]
mk:arch impact [change description]
```

## new [title]

1. Scan `docs/architecture/adr/` for an existing ADR on the same decision.
2. Gather context before writing anything: what decision is being made, what constrains it,
   what options exist. If any of the three is unknown, ask — an ADR with an invented context
   records a decision nobody took.
3. Delegate the body to the `architect` agent, with the sections: Title, Status (Proposed),
   Context, Decision, Consequences, Alternatives Considered.
4. Write `docs/architecture/adr/YYMMDD-decision.md`.
5. Print the path and a one-paragraph summary, then ask for review. A Proposed ADR is not an
   approved one.

## list

1. Scan `docs/architecture/adr/`.
2. Print one row per ADR — file stem, title, status — with superseding links resolved:

   ```
   ADR                      | Title                          | Status
   260105-postgres-storage  | Use PostgreSQL for persistence | Accepted
   260112-event-driven      | Event-driven architecture      | Proposed
   260120-monorepo-layout   | Monorepo structure             | Superseded by 260301-polyrepo
   ```

## review [ADR file stem]

1. Read the ADR.
2. Evaluate three things explicitly: is the decision still valid, has the context changed, are
   there alternatives that did not exist when it was taken.
3. Update the status when the answer demands it — Proposed → Accepted, Accepted → Deprecated,
   Accepted → Superseded by YYMMDD-decision. A status left alone is also a result; say so.
4. Append dated review notes. Never rewrite the original Context or Decision text: an ADR
   records what was decided when it was decided, and editing that history makes it describe a
   system it never approved.

## impact [change description]

1. Parse the change description into the components and boundaries it touches.
2. Resolve which ADRs cover those components.
3. Name every boundary the change crosses.
4. Assess alignment per affected ADR: consistent, extends, or conflicts. A conflict is the
   finding — do not soften it into "mostly aligned".
5. Print affected components, affected ADRs, risk level, and a recommendation that names the
   ADR to revisit when one conflicts.

## Output

| Mode | Output |
| --- | --- |
| `new` | `docs/architecture/adr/YYMMDD-decision.md` plus a printed summary awaiting review |
| `list` | table of every ADR with status |
| `review` | the updated ADR with dated review notes |
| `impact` | printed assessment: components, ADRs, risk, recommendation |

## Safety notes

- An ADR is documentation, not authority: recording a decision never approves a plan or a review.
- `docs/architecture/adr/` is append-mostly. A superseded decision stays in the tree with its
  status changed, so the record of what was believed at the time survives.
