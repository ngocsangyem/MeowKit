# ADR: the Rust installer's adapter contract is a data plan plus one executor

- Date: 2026-11-10
- Status: proposed
- Scope: `crates/mewkit-adapters`, `crates/mewkit-core` of the `mewkit-next` binary
- Plan: [`tasks/plans/261110-runtime-correct-multi-runtime-delivery/`](../../../tasks/plans/261110-runtime-correct-multi-runtime-delivery/)

## Context

`mewkit-next` must install, upgrade, remove and diagnose the kit on three runtimes (Claude Code,
Codex, Cursor) at two scopes (project, global). The Node CLI it replaces does this with
hand-maintained per-runtime bundles and target-name branching; every new runtime fact edits
shared code. Target design: one emitter per runtime behind a single contract.

AgentKit's shipped contract, recovered from its binary, is the closest known-good reference: an
`Emitter` registry, `Prepare` returning a `PreparedEmission` whose `Apply` writes through a
rollback journal, optional interfaces for declared mutation paths and output roots. We mirror
the **interface shape**, not the code — nothing is copied. Four problems rule out a literal port:

1. A `Box<dyn PreparedEmission>` built from a borrowing request propagates lifetimes through
   every emitter into the command layer. Free in Go; a tax on every call site in Rust.
2. Mutation paths declared by a separate method can drift from what `apply` writes. Two sources
   of truth for "which files do we touch" is the bug that makes uninstall incomplete or
   over-broad.
3. `uninstall` and `doctor` need the output roots when nothing has been prepared, so roots
   cannot live on the prepared value.
4. A per-emitter `apply` means one implementation per runtime of the same journal, backup,
   dry-run and ownership sequence — the part that must be identical everywhere.

## Decision

**Emitters compute. The core executes. Nothing an emitter returns borrows.**

### Contract (`mewkit-adapters`)

```rust
trait Emitter: Sync {
    fn target(&self) -> Runtime;
    fn roots(&self, scope: &Scope) -> Roots;
    fn prepare(&self, req: &EmitRequest<'_>) -> Result<Plan, EmitError>;
    fn plan_strip(&self, scope: &Scope, owned: &OwnershipIndex) -> Result<Plan, EmitError>;
}
```

`roots` is on the emitter, not the plan: available at uninstall and doctor time. `plan_strip`
puts removal on the same contract as installation, so uninstall is not a second code path of
exported per-runtime planner functions.

`Plan { ops, notices, dropped_hooks, narrowed_hooks, unsupported }` — owned data, no borrows,
`Send`-able, inspectable, snapshot-testable without touching a filesystem. `Plan` and `Op` are
defined in `mewkit-core::plan` (the executor consumes them, and `mewkit-adapters` depends on
core, not the reverse) and re-exported from `mewkit-adapters::contract`. `EmitRequest<'a>`
borrows (kit, hook manifest, scope, packs, disabled keys, model overrides, fresh); the borrow
ends when `prepare` returns.

`Op::{ WriteFile{path,bytes,mode}, RemoveFile{path}, MergeBlock{path,id,content},
StripBlock{path,id}, MergeEntries{path,format,key,entries},
StripEntries{path,format,key,names} }`. Blocks are Markdown only, so they carry no format;
entries are JSON or TOML. Split by **file ownership**: `WriteFile` / `RemoveFile`
for files we own outright; the merge/strip pairs for user-owned files where our contribution
must be surgically added and removed. Each pair carries a property test of
`strip(merge(user, x)) == user`: byte-exact for Markdown and TOML; for JSON, equal values in
the same key order, since a JSON merge rewrites the file with 2-space indentation.

### One executor (`mewkit-core::exec`)

`execute(plan, scope, index, kit_hash, opts) -> Result<EmitReport, ExecError>`, in fixed order
(`kit_hash` answers the kit's own SHA-256 for a path; the delete rule below rests on it;
`exec::Scope` is the resolved root, roots and state paths, distinct from the adapters' `Scope`):
**validate** every op path against `roots` (no absolute path outside the scope root, no `..`, no
symlinked parent — including the executor's own index, lock and backup paths — and no op of any
kind on the never-delete set for memory, telemetry, state, cache, backups and `.env`) → **dry-run** returns the
report with no disk contact → otherwise **scope lock** → **backup** every path an op changes →
**journal** pre-images → **apply** ops → **ownership index** → **commit**. Drop without commit
rolls back; rollback restores pre-images and removes created files and empty created directories.

Mutation paths, dry-run output and backup sets are *derived from the plan* — they cannot drift,
because there is nothing to keep in sync.

### Registry

`registry() -> &'static [&'static dyn Emitter]`, written out explicitly — no `init()`-time
registration, no inventory macro. A test asserts exactly one emitter per `Runtime` variant, so a
new runtime fails the suite rather than going silently missing.

### Delete authority

The ownership index (JSON, per target per scope) carries `schema_version`, `kit_version`,
`kit_contract`, `packs`, `origin` and four **maps**:

```
paths:       { rel path → sha256 }
hooks:       { hook id   → sha256 }
mcp_servers: { name      → sha256 }
sections:    { rel path  → { section id → Section } }
```

Identifier and hash live in one entry, so they cannot disagree, go out of order or differ in
length — the failure mode of AgentKit's parallel `paths` / `path_hashes` arrays. A `Section`
records what a merge contributed to a user-owned file — `format`, container `key`, entry
`names`, how many containers it `created`, and whether it created the file — so a strip removes
exactly that and deletes the file only if the kit created it and it is now empty. A binary
refuses an index whose `schema_version` exceeds its own.

Classification mirrors the npm CLI's classes: **clean** (bytes match the recorded hash **and**
the kit's bytes — the only deletable class), **modified**, **missing**, **orphan**, **protected**
(never-delete set), **refused** (the kit does not ship this path, so the index's claim is not
corroborated). The index alone never authorizes a delete; `refused` is the class that says so
out loud, instead of weakening the rule to "the ledger says we own it".

### Kit verification, and what is excluded

SHA-256 only, from `checksums.txt` in the release; a mismatch is terminal; no signature code is
ported and no signing key introduced (user decision, 2026-11-10: open source, checksums only).
A release without `checksums.txt`, or a kit without `.claude/kit-contract.json`, is refused
unless `--allow-unverified-kit` is passed; the install's `origin` then records `unverified`.
A checksum fetched from the artifact's own origin proves integrity of the download, not
authorship — trust rests on GitHub and TLS; that belongs in the installer docs.

`Invoke` / `Stream` (AgentKit's runtime-execution half) are **not** on the trait: mewkit runs no
agent, so there is no consumer. Adding them is Ask-first.

## Name mapping

| Ours | AgentKit's recovered name | Difference |
| --- | --- | --- |
| `Emitter::target() -> Runtime` | `Emitter.Target() string` | enum, not string — exhaustive match |
| `Emitter::prepare() -> Plan` | `Emitter.Prepare() (PreparedEmission, error)` | data, not an object with behaviour |
| — | `Emitter.Emit()` | dropped: `prepare` + `execute` is the only path |
| `mewkit-core::exec::execute` | `PreparedEmission.Apply()` | one core function, not per-emitter |
| `Emitter::roots()` | `PreparedOutputRoots.OutputRoots()` | on the emitter, available with no prepare |
| `Plan.ops` paths | `Global/ProjectMutationPathsEmitter` | derived, not declared |
| `Emitter::plan_strip()` | exported per-runtime `Plan*Strip` / `Strip*` funcs | on the trait |
| `Plan.notices` / `dropped_hooks` / `narrowed_hooks` / `unsupported` | `EmitReport.Notices` / `HookGroupsDropped` / `HookMatchersNarrowed` / `CapabilityExclusions` | computed at plan time, carried into the report |
| `EmitRequest<'a>` | `EmitRequest` (28 fields) | 7 fields; the rest were per-command flags |
| `Journal` | `TreeJournal` / `FileJournal` | one type, `commit` / `rollback` |
| `OwnershipIndex` | `codexOwnershipIndex` / `cursor.ownershipIndex` | one shape for all targets; `schema_version` added |
| `paths` / `hooks` / `mcp_servers` maps | `paths`+`path_hashes` / `hook_ids`+`hook_hashes` / `mcp_servers`+`mcp_hashes` | id→hash map, not two parallel arrays |
| `registry()` | `Register` / `RegisterEmitter` / `RegisterInstallable` | one registry, static |
| not present | `AgentAdapter.Invoke` / `.Stream` | excluded, see above |

## Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| **Boxed `PreparedEmission`** — the literal port | The prepared value borrows kit and manifest, so the lifetime propagates into the command layer and any future parallel-target work; and it reinstates per-emitter `apply` — three copies of the journal/backup/ownership sequence that must not differ between runtimes, plus a per-emitter dry run with its own bugs. |
| **Hand-declared mutation paths** (`GlobalMutationPaths` / `ProjectMutationPaths`) | Two sources of truth. A path written by `apply` but missing from the declaration is never backed up and never removed; a path declared but not written makes doctor report phantom files. Deriving both from `plan.ops` makes that bug class unrepresentable. |
| **JS delegation shim** — Rust CLI shelling out to the Node emitters | Rejected by the locked plan decision (full rewrite, no shim): keeps the bundle-per-runtime design that is the reason for this work, needs Node on every install path rather than only for hooks, leaves two ownership-ledger formats to reconcile at cutover. |

## Consequences

- **Positive.** Journal, backup, dry-run, path validation and ownership live in one tested place;
  a new runtime is one `Emitter` impl plus a registry line. Plans are pure data, so an emitter's
  full output is a snapshot test with no filesystem. `prepare` and `plan_strip` on one trait
  means install and uninstall cannot diverge; map-shaped ownership means id and hash cannot.
- **Negative.** `Op` is a closed set: a runtime needing an edit no variant expresses forces a
  core change (cheap now, dearer once three emitters exist). `Op::WriteFile` holds whole-file
  bytes in memory — fine at kit size, not for large assets. Format-preserving TOML/JSON merges
  are harder than append-and-hope and risk comment/order loss, mitigated by property tests over
  commented documents.
- **Neutral, and binding on the kit.** Emitters emit only `Op`s, so every runtime difference must
  be expressible in the neutral hook manifest the kit ships. It must carry: matcher as a **tool
  class** (`edit`, `read`, `shell`, `mcp`, `any`), not a Claude tool name — Cursor maps read and
  shell to dedicated matcher-less events, Codex maps edit to `apply_patch|Edit|Write`;
  `fail_closed` per handler, since Cursor fails open on a non-zero exit unless told otherwise
  while Claude and Codex block only on exit 2; a **per-runtime path anchor** — Claude has
  `${CLAUDE_PROJECT_DIR}`, Codex has no project-dir variable, Cursor's cwd differs between
  project and user hooks; `command` + `args`, which the emitter quotes into the single command
  string Codex and Cursor expect; and the Cursor-only `sessionEnd`, `subagentStart`,
  `subagentStop` plus the MCP execution events the current Cursor bundle already ships with no
  Claude-side source — carry them or record a decision to drop them, or Cursor regresses.
- Capabilities no manifest shape can express (Codex has no read-tool hook, no tool-failure
  event) stay runtime gaps: reported in `Plan.unsupported` and surfaced by `doctor`.
- Kit integrity is a checksum, not a signature: anyone able to publish a release in this
  repository can ship bytes that verify. Accepted with the no-signing-keys decision; revisiting
  it is a new ADR, and the dormant signature code in the Node CLI is not ported meanwhile.
