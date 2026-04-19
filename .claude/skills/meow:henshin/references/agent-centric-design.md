# Agent-Centric Design Rules

Rules for choosing what to expose and how to shape it when wrapping code for CLI + MCP consumption by AI agents.

Load this reference during Phase 3 (Agentize Map) of `meow:henshin`.

## Select capabilities

Keep a capability if **at least one** is true:

- An agent can accomplish a user task by calling it directly
- It is a workflow step that is awkward or error-prone to express in prose
- It is idempotent or easily made so

Drop a capability if **all** are true:

- It is a thin passthrough over another capability
- It is purely internal plumbing
- Its output is too large to be useful in context (>3 KB typical)

## Consolidate workflows

Bad:

```
list_items  →  get_item  →  check_quota  →  create_item   (4 tools, agent orchestrates)
```

Good:

```
create_item(name, …)   internally checks quota, dedupes by name, returns the record
```

Rule: if the README's "how to use" says "first call X, then Y, then Z", that is **one** tool, not three. Tool boundaries are user-outcome boundaries, not API-endpoint boundaries.

## Optimize for context

- Default responses are **concise** — return IDs + names + status, not full payloads
- Offer `format: "detailed"` / `--detailed` opt-in for full data
- Paginate. Default page size small (10–25)
- Prefer names over IDs in responses: `{ "project": "acme-web" }` beats `{ "project_id": "prj_7f3c2…" }`
- Truncate long fields with a `…` marker + length hint

## Actionable errors

Every error must answer: **what failed, why, and what to try next**.

Bad:

```
Error: 400 Bad Request
```

Good:

```
Error: rate_limited
Message: Exceeded 60 requests/minute. Retry after 12s, or pass --concurrency 2.
```

Include an `error_code` machine field for agent branching. Error strings without codes force the agent to pattern-match free text — brittle.

## Safe vs mutating vs destructive

| Tier | Behavior | Tool description must say |
|---|---|---|
| **Safe** (read-only) | No state change. Safe to call speculatively. | "Returns …" |
| **Mutating** | Changes state. Prefer supporting `dry_run: true` that returns the diff. | "Modifies …", "Creates …", "Updates …" |
| **Destructive** | Irreversible. Requires `confirm: true` or a unique token returned by a preceding `plan_*` tool. | "⚠ Deletes …" — mark explicitly |

## Naming

- **Tools (MCP):** `verb_noun`, snake_case — `list_projects`, `create_project`, `search_logs`
- **CLI commands:** `noun verb` or `verb`, kebab-case — `project list`, `project create`, `search`
- **Flags:** long-form kebab-case, short-form single-letter only where universal (`-v`, `-h`)

## Idempotency

Where possible:

- Creates accept a client-supplied idempotency key
- Updates are PATCH-shaped (only send changed fields)
- Deletes succeed if the target is already absent

## Output shape (JSON)

Default when `--json` or MCP structured content:

```json
{
  "ok": true,
  "data": { … },
  "warnings": [],
  "next_actions": ["optional hints for the agent"]
}
```

`next_actions` is the highest-leverage field — it teaches the agent which tool to call next, eliminating a round-trip through the model.

## Gotchas

- **Wrapping every public function is the #1 mistake.** Capability cut pass exists because agent-tool quality ≫ agent-tool quantity. 8 sharp tools beat 40 mirror tools.
- **"Concise" means <1 KB typical, not "most of the payload".** If the default response exceeds 1 KB, either the schema is too wide or detail should be opt-in.
- **Opaque IDs kill agent comprehension.** `prj_7f3c2d8a` tells the agent nothing; `acme-web` lets the agent reason about the entity. Use names in the default path and IDs only when uniqueness demands it.
- **Error strings without codes are brittle.** Machine-readable `error_code` is non-negotiable — agents branching on prose break the moment the prose changes.
- **Mutating tools without `dry_run` force the agent to guess.** When the mutation is not trivial, `dry_run: true` returning the diff is the cheapest safety net.
