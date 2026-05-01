# System Architecture

For full meowkit system architecture see `meowkit-architecture.md`.

---

## orchviz Write Surface (v1.2)

Introduced in `260501-orchviz-plan-writeback`. Extends the read-only v1.1
orchviz server with a POST endpoint for toggling individual todo checkboxes.

### Endpoints

| Method  | Path                | Description                                                        |
| ------- | ------------------- | ------------------------------------------------------------------ |
| GET     | `/api/plans`        | Array of non-archived plan summaries, mtime-desc, capped at 100.  |
| GET     | `/api/plan?slug=`   | Full plan state for a specific slug (or most-recent if no slug).   |
| POST    | `/api/plan/todo`    | Flip one todo checkbox in a phase file (atomic write).             |
| OPTIONS | `/api/plan/todo`    | CORS preflight for allowed origins.                                |

### Auth Model

- **Origin allowlist** (case-insensitive exact equality): only
  `http://127.0.0.1:<port>` and `http://localhost:<port>` are accepted.
- **No auth tokens** — orchviz binds `127.0.0.1` only; Origin guard prevents
  DNS-rebinding attacks without requiring secrets.
- **GET/HEAD** endpoints have no Origin check (read-only, no state change).
- **POST + OPTIONS** check Origin first — disallowed origin → 403 immediately,
  no ACAO header emitted.

### ETag Round-Trip

```
Client  →  GET /api/plan?slug=foo
           Server reads phase-NN-*.md, sha256 each file
           Returns { phaseEtags: { "1": "<hex64>", "2": "<hex64>", … } }

Client  →  POST /api/plan/todo { slug, phase, todoIdx, checked, etag }
           Server re-reads file, re-hashes
           If hash mismatch → 409 { error:"stale", currentEtag:"<new-hex64>" }
           Else → atomic-write via tmp+renameSync → invalidate cache
           Returns 200 { ok:true, changed:true, etag:"<new-hex64>" }
```

Stale 409 causes the UI to discard the optimistic flip and re-fetch the plan
so the latest file content is displayed.

### Atomic Write

Same-directory temp file + `renameSync` — POSIX rename is atomic on the same
filesystem. Implementation: `src/orchviz/plan/atomic-write.ts`.

- Tmp filename: `.orchviz-tmp-<6-byte-hex>` — phase glob regex excludes leading-dot files.
- Windows `EPERM` (file open in editor): single 50ms retry, then throw → HTTP 500.
- `finally` unlinks tmp on any rename failure — no orphans on throw.
- `cleanOrphanedTmps(planDir)` removes `.orchviz-tmp-*` files older than 5 min
  on first write per slug per process.

### Read-Only Mode

Set `MEOWKIT_ORCHVIZ_READONLY=1` in the environment before launching orchviz.
- POST `/api/plan/todo` → 405 `{ error:"readonly" }`.
- UI reverts to v1.1 disabled-checkbox display.
- All GET endpoints remain unaffected.

### Editor-Conflict Note

If a phase file is open in an external editor (vim/VSCode) when a UI write
occurs, the editor will display a "file changed externally" prompt. This is
expected behavior — orchviz does not coordinate with editor locks. The atomic
rename guarantees the file is never partially written from the editor's
perspective; the editor sees the complete new version.
