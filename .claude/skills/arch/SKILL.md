---
name: mk:arch
description: Architecture Decision Record lifecycle — create, list, review and impact-analyse ADRs under docs/architecture/adr/. Use when a non-obvious architectural choice needs a durable record, when asking which ADRs an existing decision affects, or when a proposed change must be checked against the decisions already taken. NOT for codebase deepening or boundary refactors (see mk:improve-codebase-architecture); NOT for trade-off debate between options (see mk:party).
argument-hint: new [title] | list | review [number] | impact [change description]
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
when_to_use: Use when an architectural decision must be recorded, reviewed, or checked for impact. Writes and updates ADR files; the architect agent remains the author of the decision itself.
user-invocable: true
owner: docs
criticality: medium
status: active
runtime: claude-code
---

# Architecture Decision Records

Architecture as a first-class concern. Owns the ADR lifecycle under `docs/architecture/adr/`
and the impact analysis of a proposed change against the decisions already taken.

The `architect` agent authors the decision content; this skill owns the lifecycle — numbering,
file layout, status transitions and the impact read. `docs/architecture/` is the architect
agent's directory, so ADR bodies are written by that agent, never by another one.

## Usage

```
mk:arch new [title]
mk:arch list
mk:arch review [number]
mk:arch impact [change description]
```

## new [title]

1. Scan `docs/architecture/adr/` and assign the next sequential ADR number.
2. Gather context before writing anything: what decision is being made, what constrains it,
   what options exist. If any of the three is unknown, ask — an ADR with an invented context
   records a decision nobody took.
3. Delegate the body to the `architect` agent, with the sections: Title, Status (Proposed),
   Context, Decision, Consequences, Alternatives Considered.
4. Write `docs/architecture/adr/YYMMDD-title.md`.
5. Print the path and a one-paragraph summary, then ask for review. A Proposed ADR is not an
   approved one.

## list

1. Scan `docs/architecture/adr/`.
2. Print one row per ADR — number, title, status — with superseding links resolved:

   ```
   # | Title                          | Status
   1 | Use PostgreSQL for persistence | Accepted
   2 | Event-driven architecture      | Proposed
   3 | Monorepo structure             | Superseded by #5
   ```

## review [number]

1. Read the ADR.
2. Evaluate three things explicitly: is the decision still valid, has the context changed, are
   there alternatives that did not exist when it was taken.
3. Update the status when the answer demands it — Proposed → Accepted, Accepted → Deprecated,
   Accepted → Superseded by #N. A status left alone is also a result; say so.
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
| `new` | `docs/architecture/adr/YYMMDD-title.md` plus a printed summary awaiting review |
| `list` | table of every ADR with status |
| `review` | the updated ADR with dated review notes |
| `impact` | printed assessment: components, ADRs, risk, recommendation |

## Safety notes

- An ADR is documentation, not authority: recording a decision never approves a gate.
- `docs/architecture/adr/` is append-mostly. A superseded decision stays in the tree with its
  status changed, so the record of what was believed at the time survives.
