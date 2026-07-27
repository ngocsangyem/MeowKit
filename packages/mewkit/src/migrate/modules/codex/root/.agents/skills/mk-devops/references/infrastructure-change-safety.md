# Infrastructure Change Safety

Infrastructure-as-code, deployment, rollback, and operational diagnosis. The secret boundary
in `SKILL.md` applies here without exception, and so does the rule that a human performs the
production effect.

## Contents

- [Blast radius](#blast-radius)
- [Reading a plan or diff](#reading-a-plan-or-diff)
- [Stateful resources](#stateful-resources)
- [Environment contract](#environment-contract)
- [Deployment safety](#deployment-safety)
- [Rollback and forward recovery](#rollback-and-forward-recovery)
- [Incident diagnosis](#incident-diagnosis)
- [Handoff record](#handoff-record)

## Blast radius

Before writing the change, answer:

1. Which resources does this create, update, replace, or destroy?
2. Which of those hold data?
3. What depends on them that is not in this diff — another service, another environment, a
   shared network, a DNS record, a scheduled job?
4. What is the observable effect if this is applied and it is wrong?
5. Is the effect reversible, and by whom?

A change whose blast radius cannot be described is not ready to apply, regardless of how
small the diff looks.

## Reading a plan or diff

The tool in use produces a read-only preview. Generate it, then read it — an unread preview
is not evidence, and neither is a summary line.

Look specifically for:

- **Replace** (destroy-then-create) on anything, and whether it holds state.
- **Destroy** on anything the diff does not obviously intend.
- Resources changing that the diff did not mention — a shared module or a computed value can
  reach further than the edit.
- A count or scale change, which is capacity and cost, not configuration.
- Drift the preview reveals between the definition and the live state. Drift means someone
  changed something out of band; applying over it silently reverts their change.

Quote the relevant lines in the handoff. Never run the apply, deploy, or destroy step, and do
not hand over a ready-to-run one — describe it and let the operator run it.

## Stateful resources

Databases, volumes, buckets, disks, queues with retained messages, and certificate stores.

- Replacement of any of these is data loss until a restore is proven, not merely configured.
- A change to retention, lifecycle, or versioning settings can delete data later, silently.
  Treat it as a data change, not a configuration change.
- Schema semantics belong to `mk:database`. This skill owns whether the *resource* survives
  the change; it does not own what is inside it.
- Never run a production data operation as part of an infrastructure change.

## Environment contract

Derive the required environment from committed templates and configuration only.

Record, for each variable: the name, what needs it, whether it is required or optional, and
where it is expected to come from (platform secret store, platform configuration, or a
tracked default). Never the value.

When something required is absent from the tracked evidence, the deliverable is a readiness
finding: the name, the consumer, and where it is expected. Do not read a dotenv file to
check, do not ask for the value, and do not conclude it is missing in the live environment —
absence from the tree proves nothing about the runtime.

## Deployment safety

- **Name the approval point.** The exact step where a human decides.
- **State the change window and what else is deploying**, when the platform makes that
  visible; two concurrent changes make attribution impossible.
- **Prefer a strategy the platform already supports** over describing an ideal one. If the
  repository deploys by replacing the running version, say that, and design around it.
- **Define the post-deploy check** before the deploy: the specific signal that says it
  worked, and the one that says it did not.
- **Never couple an irreversible data step to a deploy step.** If a migration must precede a
  release, that ordering is a plan for a human, and the data half belongs to `mk:database`.

## Rollback and forward recovery

Every change needs one, chosen deliberately:

- **Rollback** — restore the previous state. Valid only when the previous artifact still
  exists and the change is genuinely reversible.
- **Forward recovery** — ship a correcting change. The honest answer whenever the change
  destroyed something, altered data, or cannot be un-applied.

Test the assumption the plan rests on: a rollback that needs the failing component to be
healthy, or an artifact that has already been garbage-collected, is not a plan. Write down
who performs it, how long it takes, and what is lost either way.

## Incident diagnosis

Operational diagnosis belongs here; the code defect does not.

1. **Establish what changed and when** — deploys, configuration changes, infrastructure
   changes, dependency or provider status.
2. **Establish the blast radius of the symptom** — which endpoints, which tenants, which
   region, which percentage.
3. **Read the signals the system already emits.** Do not add instrumentation mid-incident
   unless nothing else can answer the question.
4. **Separate the operational cause from the code cause.** "Errors started at the deploy" is
   an operational finding. Why the code fails is `mk:investigate`'s question — hand it over
   with the evidence rather than guessing at it.
5. **Recommend the safest reversal available**, then let a human perform it.

Never read a secret while diagnosing, and never paste log output containing one.

## Handoff record

- Platform evidence and classification.
- Blast radius, including stateful resources and out-of-diff dependencies.
- Quoted plan/diff lines for anything replaced or destroyed.
- Environment contract, names only.
- Rollback or forward-recovery path, with its assumption stated.
- Approval point and the post-change validation to run.
