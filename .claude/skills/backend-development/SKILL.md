---
name: mk:backend-development
description: "Design and implement backend service changes: API contracts, service boundaries, auth integration, reliability and delivery checks. Use for backend/API handlers, services, webhooks, jobs, or backend architecture changes. Routes schema/migrations to mk:database; security review to the existing security workflow."
version: 1.0.0
argument-hint: '[backend change]'
source: local
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
keywords:
  - backend
  - service-boundary
  - handler
  - webhook
  - background-job
  - integration
  - failure-semantics
  - backend-architecture
  - auth-integration
when_to_use: Use when adding or changing backend behavior end to end — an endpoint or handler, a service, an integration, a webhook consumer, a background job, or authenticated access to one — coordinating the contract, data, and auth owners. NOT for contract-only design or review (mk:api-design-principles), schema/query work (mk:database), infrastructure or deployment (mk:devops), or the security verdict.
user-invocable: true
owner: portability
criticality: medium
status: active
runtime: portable
---

# Backend Development

Coordinates a backend change end to end. It routes; it does not absorb the specialists.

## Ownership

| Owner | Owns | Does NOT own |
|---|---|---|
| `mk:api-design-principles` | Interface contract: resource/type/message shape, error and authorization *requirements*, compatibility and deprecation, consumer discovery | Implementation, persistence, security verdict, release |
| `mk:backend-development` | End-to-end backend change: discovery, classification, service/handler/integration work, wiring the specialists together | Contract authorship, schema/SQL, security verdict, deploy |
| `mk:database` | Data invariants, schema, migration and recovery, query/index evidence, ORM boundary | API contract, authorization verdict, infrastructure execution |
| `mk:devops` | Infrastructure-as-code, containers, CI, runtime config, deployment safety design, rollback, incident diagnosis | Deploy approval and execution, security verdict, code root-cause, schema semantics |

Routing rules — identical in all four skills:

- **Contract-only API question → `mk:api-design-principles`**, even in the middle of a task
  owned by another skill. "Contract" means what a consumer can observe: field set, error
  shape, status semantics, pagination, versioning. Extending an endpoint without changing
  any of those is not a contract change.
- **End-to-end backend change → `mk:backend-development`**, which invokes the API skill only
  when a new, public, or breaking contract is in scope.
- **A message-based change (event, webhook, RPC) splits**: the message contract belongs to
  `mk:api-design-principles`; the producer or consumer implementation belongs to
  `mk:backend-development`.
- **Schema, migration, query, index, or ORM work → `mk:database`.** No other skill writes a
  migration or generic SQL.
- **Infrastructure, containers, delivery, or deployment safety → `mk:devops`.**
- **An unscoped performance request is triaged by evidence, never by guess**:
  `mk:backend-development` locates where the time actually goes, then hands a query or index
  question to `mk:database` and a capacity or runtime question to `mk:devops`. No skill
  invents the target.
- **Code root cause → `mk:investigate`.** `mk:devops` owns the operational picture — what
  changed, where it fails, which signal proves it — and hands the defect over.
- **An auth-sensitive change**: the owning skill states the *requirement*; the security
  workflow owns the verdict.
- **Any production effect → `mk:ship` or a human.**

## Workflow

### 1. Discover

Read the active plan or task first, then the code that already exists: the affected service
or module, its callers, the tests that cover it (service, contract, data, auth), and the
conventions its neighbours follow. Use the repository's own structure map and pointers
rather than a fresh sweep.

Name what you did not find. An absent test, an absent contract test, or an unknown consumer
set is a finding, not an assumption to fill in.

### 2. Classify

| Class | Signal | Route |
|---|---|---|
| Contract-only | The change is what the interface promises, not what runs | `mk:api-design-principles`; stop here |
| Service logic | Behavior inside an existing boundary; no contract or schema delta | Stay here |
| Data | Reads or writes change shape, volume, or invariants | `mk:database` for the schema/query part |
| Auth | Identity, permission, tenancy, or an audited action is touched | State the requirement; security workflow owns the verdict |
| Async / event | Work leaves the request path — job, consumer, webhook, scheduled task | Stay here; see failure semantics below |
| Production readiness | The question is operability, not behavior | `mk:devops` |

Most real tasks are two or three of these. Handle each with its owner; keep the composition here.

### 3. Design the boundary

State which existing boundary the change lives in, and why it is not a new one. A new
service, module, or process needs an explicit justification tied to ownership, deployment,
or failure isolation — not to file size.

For anything crossing a boundary, state the failure semantics before the code: what happens
on timeout, on partial success, on retry, on duplicate delivery. If the surrounding system
provides no retry or ordering guarantee, say so instead of designing one.

### 4. Implement

Implement in the owning flow, matching the discovered conventions. Reuse the local error
type, validation approach, logging shape, and test helpers rather than introducing a parallel
set. Keep contract text in the contract skill and link to it; do not copy the style guide here.

### 5. Validate proportional to risk

Run the narrowest test that covers the change, then widen when a shared contract, a public
boundary, or an auth path was touched. Load `references/backend-readiness.md` only when the
change is public-facing or high-risk.

## Output

No new report artifact. Extend the workflow artifact already in use with: the affected
boundary, the contract delta (or "none"), the auth and data decisions, the failure semantics,
the validation evidence, and the handoffs made.

## References

| File | Load when |
|---|---|
| `references/backend-readiness.md` | The change is public-facing, auth-sensitive, or otherwise high-risk |

## Gotchas

- **Name no infrastructure the repository does not already run.** A queue, cache, broker,
  replica set, or orchestrator is a proposal with an operational cost — it needs the user's
  decision, not a default. If the repository has one, use that one.
- **A new service is a deployment and an on-call surface**, not a refactor. Splitting one is
  a decision for the user, not a side effect of a handler change.
- **Invent no number.** No latency target, throughput figure, coverage percentage, or timeout
  value unless the repository states it or the user chose it. "Make it fast" means: find the
  stated target, or ask what fast means and what is slow now.
- **A webhook or consumer that is retried at least once will be delivered twice.** Make the
  handler tolerate the repeat, or state plainly that the guarantee is unknown.
- **Auth requirement is not auth verdict.** State who may do what and what an unauthorized
  caller observes; do not certify that the implementation is safe.
- **A change with no contract delta must not open a contract discussion.** Renaming an
  internal helper is not an API event.
