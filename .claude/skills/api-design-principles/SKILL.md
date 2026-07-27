---
name: mk:api-design-principles
description: "Design and review durable REST, GraphQL, RPC, or event-facing API contracts. Use for public or shared API contracts, endpoint/schema consistency, compatibility, pagination, error semantics, and API documentation. Discovers existing consumers and conventions before recommending a style."
version: 1.0.0
argument-hint: '[contract or review] [--rest|--graphql|--rpc|--event]'
source: local
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
keywords:
  - api-contract
  - rest
  - graphql
  - rpc
  - event-contract
  - contract-compatibility
  - pagination
  - error-semantics
  - deprecation
  - consumer-discovery
when_to_use: Use when authoring or reviewing an API contract — interface shape, error and authorization semantics, pagination, compatibility, deprecation, or contract documentation. NOT for implementing the handler (mk:backend-development), schema/query work (mk:database), or infrastructure and release (mk:devops).
user-invocable: true
owner: portability
criticality: high
status: active
runtime: portable
---

# API Design Principles

Durable interface contracts. Discover the existing contract before proposing a new one.

## Ownership

| Owner | Owns | Does NOT own |
|---|---|---|
| `mk:api-design-principles` | Interface contract: resource/type/message shape, error and authorization *requirements*, compatibility and deprecation, consumer discovery | Implementation, persistence, security verdict, release |
| `mk:backend-development` | End-to-end backend change: discovery, classification, service/handler/integration work | Contract authorship, schema/SQL, security verdict, deploy |
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

1. **Discover.** Find existing consumers, the current contract surface, versioning scheme,
   error envelope, pagination shape, and contract tests. Record what already exists before
   proposing anything. Never invent a convention the repository already answers.
2. **Classify the interface.** Preserve the discovered style. On greenfield, choose from
   evidence — client shape, query flexibility, streaming need, and who owns the consumer —
   not from habit. Say why.
3. **Model the contract.** Define resource/type/message shape, the authorization
   *requirement* per operation, validation and error semantics, and only the idempotency,
   concurrency, or pagination the use case actually needs.
4. **Review with examples.** Walk success, invalid input, forbidden, conflict/not-found, and
   one evolution case. A contract with no failure example is unreviewed.
5. **Hand off.** Implementation to `mk:backend-development`, persistence to `mk:database`,
   security verdict to the security workflow, release to the release workflow.

Load `references/rest-principles.md` for HTTP-specific detail, `references/graphql-principles.md`
for schema-language detail. Load neither for an RPC, event, or webhook contract.

## Compatibility and evolution

Style-neutral; applies to every shared or public contract change.

- **Additive is safe.** A new optional field, a new operation, a new enum member consumers
  already tolerate. Ship it without a version bump.
- **Breaking is everything a current consumer can observe:** removing or renaming a field,
  narrowing a type, changing a default, tightening validation, changing an error code or
  status for an existing case, or changing pagination shape.
- **Prove the consumer set before breaking.** Name every consumer found in discovery. If
  the consumer set is unknown, that is the finding — do not assume it is empty.
- **Deprecate before removing.** Announce, keep the old shape working, give consumers an
  observable signal, and remove only after migration is evidenced.
- **Versioning follows the discovered scheme.** Do not introduce a new versioning mechanism
  to an API that already has one. On greenfield, pick a mechanism only when a breaking
  change is actually foreseeable, and say which one and why.
- **Do not invent a page size, rate limit, cache policy, or sunset window.** Read it from
  the repository or ask.

## Other interface patterns

RPC, event, and webhook contracts get the same discipline, expressed in message terms:
name the message and its version, define the payload shape and required fields, state
delivery expectations the system actually provides (ordering, at-least-once, replay) rather
than assumed ones, and define failure semantics for the consumer.

Do not translate a message contract into an invented REST resource. Do not design a queue,
retry policy, or dead-letter path when the repository has no broker — say the capability is
absent and stop.

## Output

A compact contract decision record: discovered evidence, consumer set and stability class,
style rationale, contract delta, error/authorization/compatibility semantics, validation
proof (the reviewed examples), and handoffs.

## References

| File | Load when |
|---|---|
| `references/rest-principles.md` | The contract is HTTP-shaped — methods, status codes, resource paths |
| `references/graphql-principles.md` | The contract is a GraphQL schema — types, fields, resolver-visible shape |

## Gotchas

Each default holds until its condition flips.

- **Plural nouns for collection resources.** Unless the discovered API already uses another
  convention — consistency with the existing contract beats the convention.
- **Keep nesting shallow — one level of parent context is usually enough.** Deeper nesting
  is legitimate when the child genuinely cannot be addressed without the full path; flatten
  when it can.
- **Cursor pagination when the collection is large, ordered, and concurrently written.**
  Offset is fine for a small bounded admin list, and switching an existing endpoint's
  pagination shape is a breaking change.
- **One error envelope across the contract.** When the API already ships two, converging
  them is itself a breaking change — document the target and migrate deliberately rather
  than emitting a third.
- **Address GraphQL relationship-fetch cost before the schema ships** when a field fans out
  per parent row. Hand the measurement and the fix to `mk:database`; batching is one
  mechanism, not a mandate on every resolver.
- **Status semantics carry meaning consumers depend on.** Changing the status or error code
  for an existing case is breaking even when the body is unchanged.
- **An error body must not leak internals** — no stack trace, driver error, file path, or
  host detail.
