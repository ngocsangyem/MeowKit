# Schema Design

Modelling entities, keys, relationships, tenancy, and constraints. Confirm the engine first —
`SKILL.md` step 1. Everything below is a decision with a rationale, not a house style.

## Contents

- [Follow the repository's conventions](#follow-the-repositorys-conventions)
- [Identity and keys](#identity-and-keys)
- [Attributes and timestamps](#attributes-and-timestamps)
- [Relationships](#relationships)
- [Normalization](#normalization)
- [Tenancy and authorization boundary](#tenancy-and-authorization-boundary)
- [Personal data and retention](#personal-data-and-retention)
- [Constraints belong in the database](#constraints-belong-in-the-database)
- [Engine-conditional notes](#engine-conditional-notes)
- [Shapes that usually cost more than they save](#shapes-that-usually-cost-more-than-they-save)

## Follow the repository's conventions

Read the existing schema before naming anything. Table casing, pluralization, key naming,
index naming, and timestamp columns are already decided in any repository that has tables. A
new table that disagrees with its neighbours is the defect, even when it matches a
convention you would otherwise prefer.

Where no convention exists, propose one, apply it consistently, and say it is a proposal.

## Identity and keys

State what makes a row the same row before choosing a key type.

- **Natural key** — the domain already has a unique, immutable identifier. Use it when it is
  genuinely both.
- **Sequential surrogate** — compact, ordered, good for locality and joins, and it leaks
  volume when exposed publicly.
- **Random or time-sortable identifier** — safe to expose, generatable before insert, works
  across systems; costs more space and, for fully random values, insert locality.

Whichever is chosen, add a unique constraint on the natural key when one exists — a surrogate
key does not make duplicates impossible, it just hides them.

A composite key is correct for a pure join table. Elsewhere it makes every referencing table
carry the whole key; weigh that before choosing it.

## Attributes and timestamps

Model an attribute as a column when it is queried, constrained, or required. A document or
JSON column suits genuinely open-ended attributes — accept that querying and constraining it
is weaker, and that engines differ in what they can index inside it.

Creation and update timestamps are useful on most tables and mandatory on none. Add them
where something reads them. When they exist, decide whether the database or the application
maintains them, and hold that decision consistently — mixed ownership produces rows the
application updated without touching the timestamp.

Soft deletion is a lifecycle decision, not a default. It keeps history and makes every query,
unique constraint, and retention rule conditional on it. Choose it when history is required;
say so when it is not.

## Relationships

Declare foreign keys in the database where the engine supports them. Application-level
enforcement alone permits orphans under concurrency.

Choose the referential action deliberately per relationship:

- **Restrict** — block the parent delete. The safest default when nothing says otherwise.
- **Set null** — the child survives without its parent; the column must be nullable and the
  domain must make sense without it.
- **Cascade** — the child has no meaning without the parent. It deletes rows silently and in
  bulk; treat adding one as a data-loss review, not a schema detail.

Index a foreign key when it is used to look up children, or when the engine needs it to check
the parent delete efficiently. Do not index every foreign key reflexively — each index is
write cost paid on every insert and update.

## Normalization

Normalize by default because it makes invariants enforceable in one place. Denormalize with a
stated reason: a measured read cost, a consistency requirement that the normalized shape
cannot express, or an evolution constraint.

Both directions need the rationale. "Denormalized for performance" without a measurement is
speculation; so is "fully normalized" applied to a shape nobody queries that way.

When a derived value is stored, state what keeps it correct and what happens when that fails.

## Tenancy and authorization boundary

For multi-tenant data, decide and write down:

- Where the tenant identifier lives on each table, and whether every query path carries it.
- What is unique **per tenant** versus globally — a uniqueness constraint that forgets the
  tenant column is a cross-tenant collision or a cross-tenant leak.
- Where isolation is enforced: in the query layer, in a database-level policy, or by
  separate schemas or databases. Each has a different failure mode when a caller forgets.
- What a query that omits the tenant filter returns. If the answer is "everything", that is
  the finding.

The requirement is stated here; the verdict on whether it is enforced correctly belongs to
the security workflow.

## Personal data and retention

Mark which columns hold personal data. State the retention rule and how deletion or
anonymization is executed — a retention policy with no mechanism is not a policy.

Remember that copies propagate: backups, replicas, exports, caches, and search indexes. Note
which ones exist; `mk:devops` owns them.

## Constraints belong in the database

Uniqueness, non-null, check constraints, and foreign keys are the invariants the application
cannot forget. Express them in the schema wherever the engine can enforce them, even when
the application also validates.

Where the engine cannot (a cross-row rule, a conditional uniqueness the engine lacks), say
explicitly where it is enforced instead and what happens under concurrency.

## Engine-conditional notes

Confirm the engine, then apply only the relevant note:

- **Enumerated values** — a dedicated enum type gives stronger checking but altering it is a
  schema change with engine-specific limits; a constrained text column is easier to evolve.
  Pick per how often the set changes.
- **Empty string is not null.** Where absence is meaningful, allow null and mean it; a
  not-null default of empty string produces two representations of "nothing".
- **Engines differ in what a schema change locks.** SQLite rewrites the table for most
  `ALTER` operations. MySQL's online capability depends on the algorithm the change can use.
  PostgreSQL is online for many operations but not all. Never assume a change is free; a
  change to a table that already holds data is a migration question, not a modelling one.
- **Case sensitivity, collation, and text comparison differ by engine and configuration** and
  silently change what "unique" means. Confirm them before relying on a unique constraint over
  text.

## Shapes that usually cost more than they save

| Shape | Cost | Usually better |
|---|---|---|
| Entity-attribute-value | No type safety, no useful constraint, every query becomes a self-join | Real columns; a document column for genuinely open attributes |
| Polymorphic reference with no type discriminator | No enforceable foreign key; orphans are invisible | Store the type alongside the identifier, or use one table per relationship |
| Delimited list inside one column | Individual values are not queryable or constrainable | A junction table |
| A derived value with nothing maintaining it | Drifts silently from its source | Compute it, or state and test what keeps it correct |
