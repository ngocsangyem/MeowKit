---
title: Plan Creator Modes and Flags
description: How to choose MeowKit plan-creator modes and flags by workflow risk, context cost, and execution impact.
---

# Plan Creator Modes and Flags

MeowKit planning is risk control. Use the smallest planning surface that can answer the real engineering questions before code changes start.

The planner has two kinds of controls:

- **Modes** choose the planning workflow. A run has one planning mode.
- **Flags** modify the selected workflow. A flag can compose with a mode when the skill supports it.

The important distinction: `--deep` is a mode. `--tdd` is a flag. Running `--deep` does not enable TDD. Running `--deep --tdd` enables both bounded deep planning and tests-first execution handoff.

## Documentation outline

This page uses a MeowKit-native structure:

1. Pick by workflow risk, not by habit.
2. Route context before planning: scout, brainstorm, then plan.
3. Choose one planning mode.
4. Add only the flags that change a real workflow constraint.
5. Preserve isolation between planning, handoff, and execution.
6. Avoid heavy modes when the scope does not justify them.

## Start with the workflow risk

Ask what can go wrong if the plan is too light.

| Risk | Use | Why |
|---|---|---|
| The change is tiny and obvious | `--fast` or no plan if the workflow allows it | Avoid planning overhead for a small edit |
| The task needs a normal implementation plan | default or `--hard` | Capture goal, constraints, phases, and validation |
| The code area is broad or dependency-heavy | `--deep` | Build a bounded phase map before execution |
| Independent work can run safely in parallel | `--parallel` | Add ownership boundaries and parallel groups |
| Two plausible designs compete | `--two` | Compare approaches before selecting one |
| The request is a new product spec, not a file plan | `--product-level` | Produce product-level requirements before implementation planning |
| The work is an investigation with a deadline | `--spike --timebox <duration>` | Bound research and produce findings |
| Existing behavior must not drift | add `--tdd` | Preserve behavior with tests-first sections and cook handoff |

Do not turn on a heavier mode because it feels safer. Heavy planning adds tokens, state, and review surface. It pays off only when it prevents a likely failure.

## Route context before planning

`mk:scout`, `mk:brainstorming`, and `mk:plan-creator` solve different problems.

| Tool | Belongs here | Use when | Output |
|---|---|---|---|
| `mk:scout` | Context discovery | You do not know where files, tests, contracts, or dependencies live | File map, architecture fingerprint, relevant paths |
| `mk:brainstorming` | Approach selection | More than one credible design exists, or trade-offs are unresolved | Chosen approach and rationale |
| `mk:plan-creator` | Execution planning | Scope and approach are concrete enough to turn into phases | `plan.md`, phase files, validation, handoff |

Planning should pause when either the code map or the approach is unclear.

- Unknown files, tests, or contracts: scout first.
- Unknown architecture or trade-off: brainstorm first.
- Unknown both: do not draft implementation phases yet.
- Known area and known approach: plan directly.

`--deep` can replace a separate scout only when the prompt already names the feature area and the intended approach. It is not a substitute for deciding the approach.

## Choose one planning mode

Modes change the planning pipeline. Pick one.

| Mode | What it does | Use when | Do not use when | Context impact |
|---|---|---|---|---|
| default | Lets plan-creator classify complexity and route to fast or hard behavior | You trust the scope classifier and the task is ordinary | You need a specific workflow guarantee | Variable |
| `--fast` | Skips research, codebase analysis, red-team, and validation interview; writes a compact `plan.md` | Small, clear changes that still need Gate 1 | Multi-file refactors, security work, unclear scope | Low |
| `--hard` | Full planning pipeline with research, codebase analysis, phase files, semantic checks, red-team, validation, Gate 1, hydration, handoff | Normal complex features, bug fixes, refactors, security work | Tiny edits or time-boxed investigation | Medium to high |
| `--deep` | Hard pipeline plus bounded scope map and per-phase Deep Phase Map | Broad refactors, 5+ directories, hidden dependencies, shared contracts | Small fixes, undecided architecture, vague feature area | High, bounded |
| `--parallel` | Hard pipeline plus ownership matrix and parallel group hydration | Independent phases can be assigned without file overlap | Shared-file refactors or unclear dependencies | High |
| `--two` | Drafts two approach files and a trade-off matrix before selecting one | Two specific approaches are both credible | You have not narrowed the problem enough to name the two approaches | High |
| `--product-level` | Writes a product-level spec, not implementation phase files | Greenfield product request with no existing implementation context | Existing-code changes that need file paths and phase files | Medium |
| `--spike --timebox <duration>` | Writes an investigation plan with findings, no test or ship phase | You need to learn before committing to implementation | Delivery work that already has a clear approach | Low to medium |

### Default mode

Default mode is useful when the request is concrete and you do not need to force a planning depth. Plan-creator classifies the task as trivial, simple, or complex. Trivial work exits. Simple work uses fast mode. Complex work uses hard mode unless a deeper mode is selected or suggested.

Default mode keeps friction low, but it gives less explicit control over planning cost.

### `--fast`

`--fast` produces a small plan. It skips research, broad codebase analysis, red-team, and validation interview. It still runs semantic checks and still stops at Gate 1.

Use it for a focused change where extra analysis would mostly add noise.

Avoid it when the work touches contracts, migrations, auth, payment flows, background jobs, or behavior that needs regression protection.

### `--hard`

`--hard` is the normal full workflow. It runs research, codebase analysis, phase generation, semantic checks, red-team, validation interview, Gate 1, task hydration, and deterministic handoff.

Use it when you need a real implementation plan but do not need per-phase deep mapping.

The cost is reasonable for complex work. It becomes overkill for narrow edits.

### `--deep`

`--deep` is bounded planning depth. It adds:

- scope scout across max 5 roots
- compact scope map with tests, contracts, risky dependencies, and uncertainty
- per-phase scouting from the phase file paths
- Deep Phase Map in each phase: file inventory, test gap matrix, interface checklist, dependency map
- max 7 phases, max 3 scout calls per phase, max 12 file inventory rows per phase

Use `--deep` when execution would otherwise rediscover scope during implementation.

Avoid `--deep` when the approach is undecided. Run `mk:brainstorming` first. Avoid it for small fixes where the inventory costs more than the edit.

`--deep` does not run an uncontrolled repository-wide scan. It records uncertainty instead of expanding forever.

### `--parallel`

`--parallel` plans work for parallel execution. It adds file ownership globs, parallel groups, and dependency-aware task hydration.

Use it when phases can run independently with clear ownership.

Avoid it when phases share the same files, depend on a migration not yet created, or require sequential learning. Parallelism without ownership clarity creates merge risk and duplicated context.

### `--two`

`--two` handles a real fork in design. It creates two approach drafts and a trade-off matrix, then asks for selection before continuing.

Use it when you can name the competing approaches.

Avoid it when the problem is still vague. Brainstorm first. `--two` compares concrete candidates; it does not discover the whole solution space.

### `--product-level`

`--product-level` produces a product spec. It writes user stories, features, design language, and scope boundaries. It does not write implementation phase files.

Use it for greenfield requests such as "build a dashboard app" when there is no implementation context yet.

Avoid it for existing-code changes. If the task names files, modules, bugs, or refactors, use an implementation plan.

`--no-design` and `--no-scout` are product-level modifiers. Use them only when that part of the product spec is unnecessary or harmful for the request.

### `--spike --timebox <duration>`

`--spike` is for investigation. It requires a timebox and uses a two-phase investigate/findings template. It skips research, codebase analysis, red-team, and validation interview.

Use it when the next correct action is learning, not implementation.

Avoid it when you already know the implementation path. A spike should end with findings, not shipped code.

## Add flags only when they change the workflow

Flags compose with a mode. They should carry a concrete workflow reason.

| Flag | What it changes | Use when | Do not use when | Execution impact |
|---|---|---|---|---|
| `--tdd` | Adds tests-first sections and preserves `--tdd` in cook handoff | Existing behavior must be preserved | Greenfield prototypes, docs-only work, unstable UI polish | Cook enforces RED-first when invoked with `--tdd` |
| `--no-design` | Skips design language generation in product-level mode | Design language is out of scope | Product UX needs visual direction | Product spec is smaller |
| `--no-scout` | Skips light codebase scout in product-level mode | Existing repo context would mislead a greenfield spec | Existing docs or brand constraints matter | Less context loaded |
| `--timebox <duration>` | Sets the spike limit | Investigation must be bounded | Delivery work needs phase planning | Spike remains findings-only |

### `--tdd`

`--tdd` is not a planning mode. It adds regression-first structure to the selected mode.

When enabled, phase files may include:

- `tdd: true`
- `regression_gate: "<command>"`
- `## Tests Before`
- `## Protected Change`
- `## Tests After`
- `## Regression Gate`

Task hydration treats `Tests Before` checkboxes as RED-phase critical tasks. Post-plan handoff prints a cook command with `--tdd`, because execution enforcement belongs to cook.

Use `--tdd` for behavior-preserving refactors, bug fixes with user-visible behavior, public APIs, auth, payments, data workflows, async jobs, and state machines.

Avoid `--tdd` for greenfield prototypes or work where there is no stable behavior to capture. In those cases it often creates superficial tests.

## Planning depth and cost

Planning depth is the amount of context and verification the planner loads before Gate 1.

| Depth | MeowKit shape | Best for | Cost |
|---|---|---|---|
| Lightweight planning | default simple path or `--fast` | Small fixes and clear tasks | Low token cost, low state |
| Architectural planning | `--hard`, `--two` | Complex work, design choices | Medium/high token cost |
| Bounded repository planning | `--deep` | Broad scope with hidden dependencies | High token cost, bounded by scout limits |
| Verification-oriented planning | any mode + `--tdd` | Refactors that must preserve behavior | Adds phase structure and execution constraints |
| Parallel execution planning | `--parallel` | Independent work streams | Adds ownership state and coordination cost |

More planning can improve quality, but only when it answers a question execution would otherwise guess. If the answer is already known, more planning is noise.

## Context-engineering implications

Plan-creator uses step files so only the active step needs to be loaded. That keeps planning maintainable, but heavier modes still create more state.

| Mode or flag | Repository context loaded | Orchestration state created | Stale assumption risk |
|---|---|---|---|
| `--fast` | Minimal | Small `plan.md`, session tasks | Low, unless prompt is vague |
| `--hard` | Relevant directories and docs | Research reports, phase files, validation output | Medium |
| `--deep` | Max 5 scope roots plus phase-scoped scouts | Deep Phase Map per phase | Medium/high if scans are treated as complete truth |
| `--parallel` | Similar to hard | Ownership matrix, parallel groups | High if ownership is guessed |
| `--two` | Similar to hard for two candidate approaches | Approach files, trade-off matrix, selected approach | Medium if candidates are weak |
| `--product-level` | Light docs/brand/product context | Product spec only | Medium if implementation assumptions leak in |
| `--spike` | Intentionally limited | Findings-oriented plan | Low if timebox is respected |
| `--tdd` | No broad context by itself | TDD sections, RED tasks, regression gate | Low/medium if old bugs are mistaken for desired behavior |

Context isolation matters most after heavy planning. Planning may contain research notes, scout output, risk review, and user decisions. Execution should restart from the plan path and phase file, not from the full planning conversation.

Use the handoff command that plan-creator prints. For TDD plans, keep `--tdd` in the cook invocation:

```bash
/mk:cook /absolute/path/to/plan.md --tdd
```

## Execution lifecycle

The lifecycle is intentionally staged.

1. **Scout** finds files, tests, contracts, and dependencies. It is read-only.
2. **Brainstorming** chooses the approach when trade-offs are unresolved.
3. **Planning** turns the chosen approach into plan files, phase files, validation, and handoff.
4. **Validation** checks plan structure, claims, risk, and unresolved questions before approval.
5. **Handoff** records the next step and prints the command. It does not auto-run execution.
6. **Cooking** reads the approved plan in a fresh execution context and implements it.

Boundaries are part of the design:

- Scout should not decide architecture.
- Brainstorming should not write implementation code.
- Planning should not execute the implementation.
- Handoff should stop before cooking.
- Cook should read the plan and phase context, not the full planning conversation.

Pause for confirmation when the plan changes scope, when a risk gate finds unresolved contradictions, or when the next step changes execution behavior.

## Usage matrix

| Work shape | Recommended command | Why |
|---|---|---|
| Fix a typo in one file | Use the lightweight fix path, not deep planning | Planning cost exceeds risk |
| Add a small validation branch to a known module | `/mk:plan --fast "add validation for ..."` | Captures acceptance without research overhead |
| Add a medium feature to known API and UI files | `/mk:plan "add saved filters to reports"` | Default routing is enough |
| Implement a complex feature across API, storage, and UI | `/mk:plan --hard "add team invitations across API, email, and settings UI"` | Full planning without per-phase inventory |
| Compare event-driven sync vs polling | `/mk:brainstorming --depth deep "choose sync strategy for ..."` then `/mk:plan ...` | Decide approach before planning |
| Split a broad indexing module while preserving ranking | `/mk:plan --deep --tdd "refactor search indexing; preserve ranking behavior"` | Needs scope map and regression protection |
| Run independent backend and UI phases in parallel | `/mk:plan --parallel "add export flow with separate API and UI work"` | Needs ownership matrix |
| Build a new dashboard product from scratch | `/mk:plan --product-level "build a dashboard for ..."` | Product spec before implementation phases |
| Investigate whether a migration is feasible | `/mk:plan --spike --timebox 1d "investigate migration path for ..."` | Findings before delivery plan |

## Examples

### Small fix

```bash
/mk:plan --fast "Update the empty-state copy in the reports page.
Scope: one UI component.
Acceptance: empty state shows the new text and existing tests still pass."
```

Use `--fast` because the scope is known and the risk is low.

### Medium feature

```bash
/mk:plan "Add saved filters to reports.
Expected output: users can save, rename, apply, and delete report filters.
Scope: reports API, reports UI, existing user preferences storage.
Out of scope: sharing filters across teams."
```

Use default routing or `--hard` if the planner classifies the task as complex.

### Architectural refactor

```bash
/mk:brainstorming --depth deep "Choose an approach for extracting report generation from the request path.
Constraints: keep existing API response, avoid new infrastructure unless needed."
```

Then plan the chosen approach:

```bash
/mk:plan --deep "Refactor report generation using the selected approach.
Touch: report API, background job entry point, storage adapter, admin observability.
Preserve: current API response shape."
```

Use brainstorming first because the architecture is not yet decided. Use `--deep` after the approach is selected because the dependency map matters.

### Behavior-preserving refactor

```bash
/mk:plan --deep --tdd "Refactor search indexing without changing ranking behavior.
Preserve: ranking order, pagination cursor behavior, retry semantics.
Tooling: use the project's existing unit and integration test commands."
```

Use both because the task has broad scope and existing behavior must stay stable.

## Anti-patterns

| Anti-pattern | Why it fails | Better choice |
|---|---|---|
| Always using `--deep` | Creates excess context and stale inventory for small work | Use default or `--fast` |
| Adding `--tdd` to greenfield prototypes | No stable behavior exists to protect | Use normal tests after design stabilizes |
| Planning before approach clarity | Produces confident phase files for a weak design | Run `mk:brainstorming` first |
| Running recursive scout loops | Inflates context and delays decisions | One bounded scout pass, then record uncertainty |
| Writing giant planning prompts | Pushes noise into every phase | State outcome, scope, constraints, touchpoints, tooling |
| Skipping regression gates in risky refactors | Lets behavior drift after structural changes | Use `--tdd` and exact regression commands |
| Combining modes that do not compose | Creates unclear orchestration semantics | Pick one mode, then add supported flags |
| Treating product specs as implementation plans | Produces no concrete phase files for existing code | Use implementation planning for file-level work |

## Migration notes

If you used older wording around deep or TDD planning, update local docs and examples to these rules:

- `--deep` means bounded phase-scoped planning, not an unlimited repository scan.
- `--tdd` is opt-in and independent of planning mode.
- `--deep --tdd` is valid because one is a mode and the other is a flag.
- A TDD plan should hand off to cook with `--tdd`.
- Scout and brainstorming happen before planning when context or approach is unclear.

## Related pages

- [Workflow phases](/core-concepts/workflow)
- [How MeowKit works](/core-concepts/how-it-works)
- [Adaptive density](/guide/adaptive-density)
- [mk:plan-creator reference](/reference/skills/plan-creator)
