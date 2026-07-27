# Query Optimization

Diagnosing a slow query and choosing an index from evidence. Confirm the engine first —
`SKILL.md` step 1. Plan output, index types, and syntax all differ by engine.

## Contents

- [Measure before changing anything](#measure-before-changing-anything)
- [Reading a plan safely](#reading-a-plan-safely)
- [What the plan is telling you](#what-the-plan-is-telling-you)
- [Choosing an index from evidence](#choosing-an-index-from-evidence)
- [When not to add an index](#when-not-to-add-an-index)
- [Query shapes that defeat an index](#query-shapes-that-defeat-an-index)
- [Repeated queries in a loop](#repeated-queries-in-a-loop)
- [Pagination cost](#pagination-cost)
- [Connections and pooling](#connections-and-pooling)
- [Statistics](#statistics)

## Measure before changing anything

Establish, in order:

1. **Which query.** The exact statement the application sends, with its real parameters —
   not a simplified version.
2. **How slow, and against what.** Current timing, current row counts, and the target. If no
   target exists, ask for one; "fast" is not a measurement and neither is a number you chose.
3. **How often.** A query taking a second once an hour and one taking a second per request
   are different problems.
4. **What changed.** A query that got slower has a cause — data volume, a plan flip, a lost
   index, stale statistics.

An optimization with no before-and-after measurement is a guess that also changed the code.

## Reading a plan safely

Every engine exposes an execution plan; most also expose an analysing form that reports
actual timings.

**The analysing form runs the statement.** On an `INSERT`, `UPDATE`, or `DELETE` that means
the rows change. Use the non-executing form for a mutating statement, or run the analysing
form inside a transaction you will roll back — and never against a production database at
all. Preparing the command and handing it over is this skill's job; running it against live
data is not.

## What the plan is telling you

Vocabulary differs by engine; the questions do not:

- **Is it scanning the whole table where it should be seeking?** On a large table that is
  usually a missing or unusable index.
- **Do the estimated and actual row counts diverge?** A large gap means the planner is
  working from stale or insufficient statistics, and every choice downstream is suspect.
- **Where is the time actually spent?** The slow node, not the alarming-looking one. Sorting,
  hashing, and spilling to disk often cost more than the scan being blamed.
- **How much data is being read versus found in cache?** High physical reads point at volume,
  a cold cache, or an index that is not being used.
- **Is the row count itself the problem?** A query returning far more rows than the caller
  needs is a query-shape problem, not an index problem.

## Choosing an index from evidence

Build the index from the query, never from the schema:

- **Equality columns first, then range or ordering columns.** A composite index serves a
  prefix of its columns; ordering determines what it can serve.
- **One index can serve several queries** that share a prefix. Prefer widening an existing
  index over adding a near-duplicate.
- **A partial or filtered index** — where the engine supports one — is smaller and cheaper
  when queries always constrain the same subset.
- **Specialised index types** exist for containment, text search, geometry, and similar. They
  are engine-specific; confirm what this engine offers before naming one.
- **Covering the query** so the engine answers from the index alone helps a hot read path and
  costs more write and more space.

State the expected effect before creating it, then measure whether it happened. An index that
did not change the plan should be removed.

## When not to add an index

- The column has very few distinct values and the query matches most rows.
- The table is write-heavy and the read is rare — every index is paid on every write.
- No query filters, joins, or orders by the column.
- The query is slow for a different reason: returning too much data, running too often, or
  doing work the database should not be doing.
- An existing index already covers the access pattern and is not being used — find out why
  before adding another.

## Query shapes that defeat an index

| Shape | Why it hurts | Usually better |
|---|---|---|
| A function applied to the indexed column in the predicate | The stored value no longer matches the expression | An expression index, or store the derived form |
| A type mismatch between the column and the parameter | Forces a conversion that discards the index | Match the parameter type to the column |
| A leading wildcard in a text match | Nothing to seek on | A text-search index, or restructure the match |
| `OR` across unrelated columns | Cannot use one composite index | Two indexed queries combined |
| A negated subquery membership test | Slow, and surprising with nulls | An anti-join, or an existence test |
| Selecting every column when few are needed | Extra reads, and a covering index cannot help | Select what the caller uses — where the repository's conventions allow it |
| No bound on a list query | Unbounded result and unbounded cost | Bound it, or document why the whole set is required |

## Repeated queries in a loop

One query per item in a result set is the most common cause of a slow request path, and it
rarely shows up as a slow query — each individual statement is fast.

Fix it at the access layer: fetch the related rows in one statement, or batch the lookups for
the whole set. Which mechanism is right depends on the ORM and the engine; the invariant is
that the number of round trips must not grow with the number of rows.

`mk:backend-development` owns the call site; this skill owns whether the resulting access
path is sound.

## Pagination cost

Skipping rows by offset costs more as the offset grows — the engine still traverses what it
skips. Seeking from the last-seen ordered value stays flat regardless of depth, and stays
correct while rows are inserted.

Use offset where the collection is small and bounded, or where page numbers are part of the
product. Use a seek where the collection grows. Note that changing an existing endpoint's
pagination shape is a contract change owned by `mk:api-design-principles`.

A total count over a large filtered set is its own query cost. Confirm it is affordable
before it is promised in a contract.

## Connections and pooling

Every engine has a finite connection budget, and exhausting it presents as slow queries
rather than as a pool error: callers wait for a slot until a timeout fires.

Check for connections held open past their work — a transaction left open across an external
call holds its slot for the whole call. Confirm the pool releases on every path, including
error paths. Sizing the pool is an operational decision that depends on the deployment shape;
`mk:devops` owns the runtime side of it.

## Statistics

When estimated and actual row counts disagree badly, refresh the planner's statistics for the
affected tables using the engine's mechanism before concluding anything about indexes. A
plan built on stale statistics will mislead every step that follows.
