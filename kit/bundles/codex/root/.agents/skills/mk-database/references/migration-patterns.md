# Migration Patterns

Changing a table that already holds data, and getting back when it goes wrong. Confirm the
engine and the migration tool first — `SKILL.md` step 1.

Nothing here is executed against a live database. Prepare the migration and hand execution to
`mk:ship` or a human.

## Contents

- [Use the repository's migration tool](#use-the-repositorys-migration-tool)
- [Compatibility with the running code](#compatibility-with-the-running-code)
- [Expand, migrate, contract](#expand-migrate-contract)
- [Recovery: reverse or forward](#recovery-reverse-or-forward)
- [Locking and runtime](#locking-and-runtime)
- [Backfills](#backfills)
- [Validation before handoff](#validation-before-handoff)
- [Risky operations](#risky-operations)

## Use the repository's migration tool

Read the migration directory and the tool that owns it before writing anything. Match its
file naming, its ordering scheme, its up/down convention, and whether it wraps each migration
in a transaction. Never renumber or reorder an existing migration — ordering is history that
other environments have already applied.

Where an ORM generates migrations, generate through it rather than hand-writing a file it
will not recognise.

## Compatibility with the running code

The code currently deployed keeps running during and after the migration. State, for the
change, which of these holds:

- **Backward compatible** — old code still works against the new schema. Additive changes
  usually are.
- **Requires a deploy first** — the code must stop using something before the schema drops
  it.
- **Requires a schema change first** — the code needs a column that must already exist.

That ordering is the plan. Write it down; it is the part that breaks in production, not the
SQL.

## Expand, migrate, contract

For a rename, a type change, a split, or any change that cannot be applied in one step
without breaking a running caller:

1. **Expand.** Add the new shape alongside the old. Nothing reads it yet.
2. **Migrate.** Write to both, then backfill the existing rows in batches. Verify the two
   agree.
3. **Switch reads.** Deploy code reading the new shape. Keep the old one intact.
4. **Contract.** Once nothing reads or writes the old shape and the change has proven itself,
   remove it — as a separate, later change.

Each step ships and is reversible on its own. A single-step rename on a live table is the
version that needs a maintenance window.

Say explicitly when a change is simple enough not to need this — it is not required for a new
nullable column on a table nothing else is touching.

## Recovery: reverse or forward

Every migration needs a recovery path. Choose deliberately:

- **Reverse migration** — restores the previous schema. Valid when the change is genuinely
  reversible and no data was destroyed.
- **Forward recovery** — a corrective migration. The honest answer whenever the change
  dropped a column, rewrote values, or otherwise destroyed information.

A reverse step that silently discards data is worse than declaring the change irreversible.
Do not write one just to satisfy a template: state that recovery is forward-only, and what
the corrective change would be.

Where the data itself must survive a mistake, the backup or point-in-time-recovery capability
is `mk:devops`'s to confirm — name the dependency rather than assuming it exists.

## Locking and runtime

What a schema change locks, and for how long, depends on the engine, its version, and the
table's size. Confirm all three, then estimate. Engine-conditional facts worth checking:

- **Adding a column with `NOT NULL` and no default** can rewrite the entire table under an
  exclusive lock. On PostgreSQL before 12 it does; from 12 the two-step form (add nullable →
  backfill → validate the constraint) avoids the rewrite. Other engines vary.
- **Index creation blocks writes** in the default form on PostgreSQL; the concurrent form
  avoids it but cannot run inside a transaction block and can leave an invalid index behind
  if it fails, which must then be dropped. MySQL's online behavior depends on the algorithm
  the change can use. SQLite rewrites the table for most `ALTER` operations.
- **Adding a foreign key validates existing rows** and can hold a lock for the scan. Engines
  that support adding the constraint unvalidated and validating separately turn one long lock
  into two short ones.
- **Changing a column type** may rewrite the table, or may be metadata-only, depending on the
  engine and the specific conversion.

When the lock behavior cannot be established, that is the finding — say so rather than
asserting a change is online.

## Backfills

- Keep the backfill out of the schema migration. A schema change runs at deploy time; a
  backfill over a large table needs batching, progress, and the ability to stop.
- Batch it, bound each batch, and make it resumable — it will be interrupted.
- Make it idempotent: re-running a completed batch must be harmless.
- Give it a progress signal and a completion check. "It finished" needs evidence, usually a
  count of rows still unconverted.
- Never write an unbounded update over a whole table as a migration step.

## Validation before handoff

- Apply the migration to a disposable database seeded with synthetic, non-personal fixtures.
  Copying production data elsewhere is a data-protection decision for the user, never a
  default testing technique.
- Reproduce a realistic row count when the concern is duration or locking; a change that is
  instant on an empty table proves nothing about a large one.
- Apply the recovery path and confirm the result matches expectation.
- Re-run the migration to confirm re-application behaves as the tool expects.
- State the measured duration, or state that it is unmeasured.

## Risky operations

| Operation | Risk | Handling |
|---|---|---|
| Dropping a table or column | Irreversible data loss | Contract step only, after nothing reads it; explicit human approval |
| Unbounded update or delete | Whole-table modification, long lock | Bound it, batch it, or state that the whole table is the intent |
| Schema and data change in one file | The lock and the backfill share a window | Separate files |
| Cascading delete introduced or triggered | Silent bulk removal of child rows | Audit the graph before, treat as a data-loss review |
| Running any of these against a live database | Unrecoverable in the wrong environment | Not done here — hand to `mk:ship` or a human |
