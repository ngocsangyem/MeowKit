# Backend Readiness

Load only for a public-facing, auth-sensitive, or otherwise high-risk backend change. For an
internal change inside one boundary, the checks in `SKILL.md` are enough — running this file
on a small change is ceremony, not safety.

Nothing here prescribes a number. Every threshold comes from the repository or the user.

## Contents

- [Readiness questions](#readiness-questions)
- [Failure semantics](#failure-semantics)
- [Auth and tenancy](#auth-and-tenancy)
- [Data access boundary](#data-access-boundary)
- [Observability](#observability)
- [Evidence to record](#evidence-to-record)

## Readiness questions

Answer each with evidence from the repository, or record it as unknown. An unknown is a
finding to report, never a gap to fill with a plausible default.

1. Who calls this, and which of them are outside this repository?
2. What breaks in a caller if this change is wrong — an error, wrong data, or silence?
3. Is the operation safe to repeat? If not, what makes a repeat impossible?
4. What does the caller see on each failure mode, and is that in the contract?
5. Which test proves the new behavior, and which test proves the old behavior still holds?
6. Does the change alter what is logged, stored, or exposed about a person?

## Failure semantics

For every call that leaves the process — a datastore, an internal service, a third party, a
broker:

- **Timeout.** Does one exist? What does the caller see when it fires?
- **Partial success.** Can the operation half-complete? What state is left behind?
- **Retry.** Who retries — the client, the framework, the platform, nobody? A retry that
  nobody performs is not a recovery plan.
- **Duplicate.** If the same message or request arrives twice, is the second one harmless?

State what the surrounding system actually guarantees. When the guarantee is unknown, that
sentence is the deliverable. Do not design a broker, retry policy, or dead-letter path into
a repository that has none — that is a proposal for the user, and an operational change
owned by `mk:devops`.

## Auth and tenancy

- Name the authorization requirement for each operation: who may perform it, on which
  records, and what an unauthorized caller observes.
- For multi-tenant data, state where the tenant boundary is enforced and what happens to a
  request that crosses it. Hand the data-side isolation question to `mk:database`.
- Do not choose the authentication mechanism, hashing scheme, or token format here, and do
  not certify that the result is secure. State the requirement; the security workflow owns
  the verdict.

## Data access boundary

The service states what data it needs and what invariant must hold. `mk:database` owns the
schema, the query, the index, and the migration. If this change requires generic SQL or a
migration, that is the handoff — not a task to complete here.

When an ORM sits between them, the boundary is still the same: the service asks for a
behavior, the data owner decides the access path.

## Observability

Change what is observable only as far as the change requires. Add the signal that would let
someone diagnose this specific failure, reuse the existing logging and metric conventions,
and never log a credential, token, or personal record.

Choosing the platform, dashboards, alerts, or retention is `mk:devops` work.

## Evidence to record

Fold into the existing workflow artifact — do not create a second report:

- Affected boundary and why it stayed the same or changed.
- Contract delta, or "none".
- Auth requirement and data decision, with the handoffs made.
- Failure semantics per external call.
- Tests run and what they prove; anything left unproven, named as unproven.
