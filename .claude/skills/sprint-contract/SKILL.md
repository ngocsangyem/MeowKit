---
name: mk:sprint-contract
version: 1.0.0
preamble-tier: 3
description: "Negotiates acceptance criteria before code. NOT for mk:plan-creator."
argument-hint: '[propose | review | amend | sign | sprint-goal] [task-slug | sprint-goal-text] [--sprint N]'
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - AskUserQuestion
source: local
keywords:
  - sprint-contract
  - testable-criteria
  - generator-evaluator-handshake
  - scope-negotiation
  - rubric-tie-in
when_to_use: "Sign sprint scope."
user-invocable: true
owner: lifecycle
criticality: high
status: active
runtime: claude-code
---

# mk:sprint-contract — File-Based Sprint Contract Protocol

Negotiation protocol between generator and evaluator. Produces a signed contract file at `tasks/contracts/{date}-{slug}-sprint-{N}.md` before the generator writes any source code, so both agents are grading the same scope. The contract is a shared document, not a checkpoint: no hook blocks an edit while it is unsigned.

> For single-task plan validation (cook flow), use `mk:validate-plan`; to write the plan itself, `mk:plan-creator`. This skill is for product-level specs feeding `mk:autobuild`.

## When to Use

Activate when:
- User runs `/mk:sprint-contract <action> [task-slug]`
- `mk:autobuild` (FULL density) needs to negotiate a sprint before invoking the generator
- Generator agent needs to read a signed contract before starting implementation
- A previously signed contract needs amendment due to mid-build scope discovery

Skip when:
- `MEOWKIT_AUTOBUILD_MODE=LEAN` (adaptive density: the most capable tier self-derives criteria from the product spec)
- The plan is `--fast` mode (overhead exceeds value)
- The task is `/mk:fix simple` (one small fix needs no sprint-level scope negotiation)

## Subcommands

| Subcommand | Owner | Effect |
|---|---|---|
| `propose` | generator (developer agent) | Drafts a contract from the product spec + rubric preset; status: `draft → negotiating` |
| `review` | evaluator | Critiques the proposed contract for testability + scope clarity; produces clarification requests |
| `amend` | generator | Iterates on the contract per evaluator feedback; status stays `negotiating`; rounds += 1 |
| `sign` | both | Both agents commit to the contract via git commit messages; status: `negotiating → signed` |
| `sprint-goal` | user | Writes/reads/aligns sprint-LEVEL goal in `tasks/contracts/sprint-state-{date}-sprint-{N}.md` (Agile mode) |

## Workflow

### `propose` (generator)

1. Read the active product spec from the newest `tasks/plans/*/plan.md`.
2. Load the rubric preset: `.claude/skills/rubric/scripts/load-rubric.sh --preset {preset}`.
3. Sprint `N` is the highest existing `tasks/contracts/*-{slug}-sprint-*.md` number plus 1 (default 1).
4. Copy `assets/contract-template.md` to `tasks/contracts/{YYMMDD-HHMM}-{slug}-sprint-{N}.md` and fill it: acceptance criteria in Given/When/Then form, each bound to one preset rubric and carrying a Verification line, enough that every in-scope behaviour is checked and every preset rubric is bound at least once; frontmatter `status: negotiating`, `rounds: 0`, `created`.

Done when the file exists with every template section filled. Tell the user the path and that it awaits evaluator review.

### `review` (evaluator)

1. Read newest `negotiating` contract for the active task
2. Per AC check: **Testable?** (probable via browser/curl/CLI) **Rubric-aligned?** (binding matches content) **Scope clear?** (no ambiguity)
3. For each weak AC, append `Round {N+1} (reviewer): AC-{NN} {clarification}` to Negotiation Log
4. If clean, write `Round {N+1} (reviewer): accepted` and proceed to `sign`
5. If clarifications added, increment `rounds` and signal generator to `amend`
6. **HARD CAP: 2 negotiation rounds.** Round 3 escalates to human by asking the user

### `amend` (generator)

1. Address every clarification from the previous round in the relevant ACs (replace, don't delete)
2. Append `Round {N+1} (proposer): {summary of changes}` to the log
3. Re-check the amended ACs against the template's AC form
4. Signal evaluator to `review` again

### `sign` (both agents in sequence)

The invariant: each agent commits the contract, then records the SHA of its own commit in its signature field, in a second commit. The SHA cannot live inside the file it commits, hence two commits per agent.

1. Generator: commit the contract (`generator_signed: pending`), set `generator_signed` to `git rev-parse HEAD` from that commit, commit again.
2. Evaluator: check the contract is unchanged since the generator's second commit, commit it, set `evaluator_signed` to its own SHA and `status: signed`, commit again.
3. The git log of the contract file is the audit trail. Once both fields hold real SHAs and the status is `signed`, the scope is agreed and the generator starts building.

Example commit messages: `contract: generator signs sprint {N} for {slug} (sha=<sha>)`.

**Signature discipline:** a placeholder (`null`, `pending`, `todo`, empty) means that agent has not signed; read it that way. Nothing checks it for you.

### `sprint-goal` (Agile mode)

`sprint-goal set "<text>" --sprint N` writes a goal of at most 120 characters to `tasks/contracts/sprint-state-{YYMMDD}-sprint-{N}.md` (created from `assets/sprint-state-template.md` if absent); `show` prints it; `align --plan <path>` compares the plan's goal with it, advisory only. The sprint-state schema and the commitment rules live in `assets/sprint-state-template.md` and `.claude/skills/agent-detector/references/agile-sprint-commitment.md`; the file is parsed inline by its consumers. Take the repository's lock helper if it has one, otherwise write the file in a single edit, so two shells do not interleave a read-modify-write.

### Mid-build amendment (post-sign)

The amendment flow MUST null both signature fields BEFORE adding the amendment block. Otherwise stale SHAs from the prior signing round would read as agreement to criteria neither agent has seen.

1. **Generator opens amendment:**
   - Edit the frontmatter: `status: amended`, `generator_signed: null`, `evaluator_signed: null`
   - Append `### Amendment N — {YYMMDD-HHMM}` under `## Amendments` describing the change
   - DO NOT edit the original signed criteria — append the revised version as a new AC or override note
   - `git commit -m "contract: amendment N for sprint {N} ({slug})"`
2. **Both agents re-sign** following the `sign` invariant above. New SHAs replace the nulled fields.
3. **While the amendment is in flight** (status `amended`, both sigs null), the sprint has no agreed scope: hold off on source edits until both agents have re-signed. This is discipline, not a block — nothing stops the write.

Original signed criteria stay visible — amendments are append-only history.

## Adaptive Density Skip

When `MEOWKIT_AUTOBUILD_MODE=LEAN`:

- The contract negotiation is **skipped entirely** (adaptive density: capable models self-derive criteria from the product spec)
- The generator implements against the product spec directly, and the evaluator grades against it
- LEAN mode is a PROJECT-level setting, not a per-file override

## Gotchas

- **Don't mutate signed criteria.** Revisions go in the Amendments section, not by editing original ACs in place
- **Don't exceed 2 negotiation rounds.** Escalate to human on round 3 — agents that can't converge in 2 rounds won't converge in 5
- **Don't skip the rubric tie-in.** Each AC must reference one rubric in the active preset, otherwise the evaluator has no anchor for grading
- **Don't write source code without reading the contract.** Nothing stops you, which is exactly why it is worth doing; the developer agent's "Contract Discipline" section says the same
- **Don't sign without git commits.** The git log is the audit trail — `generator_signed` and `evaluator_signed` fields hold real SHAs, not "yes" placeholders

## References

| File | Purpose |
|---|---|
| `assets/contract-template.md` | Canonical per-story sprint-contract schema with placeholder ACs |
| `assets/sprint-state-template.md` | Sprint-LEVEL state contract template (used by `sprint-goal set`; tracks goal + committed_tickets + amendments + closure summary) |
| `references/bdd-to-ac-mapping.md` | How Gherkin scenarios map to acceptance criteria |
| `../../agents/developer.md` | Generator agent — owns `propose` and `amend` actions |
| `../../agents/evaluator.md` | Evaluator agent — owns `review` action; also the active-verification consumer |
| `../rubric/` | Rubric library — provides composed presets the contract binds to |
| `../evaluate/` | Evaluator skill — reads the signed contract via `evaluate/step-01-load-rubrics.md` |

## Related Rules

- `.claude/rules/meowkit-core.md` — where the contract sits in the workflow, and the ship check that runs on commit, push and merge

## Start

For interactive use, run `/mk:sprint-contract propose <task-slug>` to begin negotiation.
For autobuild runs, the harness invokes propose, review, amend and sign as a substep before the generator edits source.
