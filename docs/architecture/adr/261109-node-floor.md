# ADR: one supported Node floor, and it is 24

- Date: 2026-11-09
- Status: accepted
- Supersedes: nothing (the repository previously stated no decision, only three disagreeing facts)

## Context

The repository stated three different Node floors at once:

| Statement | Where | Value |
| --- | --- | --- |
| `engines.node` | root `package.json`, `packages/mewkit/package.json` | `>=24` |
| Requirements prose | `README.md` | 20+ |
| Diagnostic + its label | `commands/doctor-checks.ts` | `major >= 20`, "Node.js >= 20" |
| Test matrix | `.github/workflows/ci.yml`, four job blocks | 24 |

The user-visible consequence was concrete: on Node 20 the README said the project was
supported, `doctor` passed, and the install then failed because the package manager enforces
`engines`. Three statements, at most one of which could be right, and nothing that told a
user which.

The reason the floor was 24 in the first place has gone away. `engines` was raised for
`node:sqlite`, which the derived index used. That index and its database were removed, and a
search of `packages/mewkit/src`, `scripts/` and `.claude/hooks/` now finds **zero**
references to `node:sqlite`. Nothing in the tree requires a Node-24-only builtin any more.

## Decision

**One floor, 24, stated in one place and read from there.**

`core/node-floor.ts` holds the constant. The diagnostic, its label and its failure text read
it; the alignment test reads it and compares it against both `package.json` manifests, the
README, the docs pages that state a floor, and the workflow files, failing when any of them
disagrees. `engines` keeps the value it already had.

## Rejected option: lower the floor to 20 and lazy-import the Node-24-only users

This was the phase's first option and it is the one a reader expects, since the constraint
that forced 24 is gone. It is rejected for two reasons:

1. **There is nothing left to lazy-import.** The option presupposes modules that need Node 24;
   the `node:sqlite` users were deleted. The work would be a no-op with a lowered number
   attached to it.
2. **20 is a floor nothing tests.** CI runs Node 24 in all four job blocks and no other
   version. Declaring 20 would publish a claim no run has ever exercised — which is how the
   original defect happened, one version lower. A floor is a promise about what is verified,
   and the only verified version is 24.

## Consequences

- Accepted cost: a user on Node 20 or 22 is now told so by the README and by `doctor`, where
  before they were told the opposite and discovered it at install time. Nobody loses a working
  setup, because `engines` already refused those versions; what changes is that the refusal is
  now predicted instead of surprising.
- v3 is a breaking major, so a floor bump needs no separate deprecation cycle.
- Lowering the floor later is a one-line change plus a matrix entry — and the alignment test
  makes the matrix entry mandatory, so the floor cannot drift ahead of what is tested again.
