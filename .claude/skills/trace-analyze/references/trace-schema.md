# Trace Log Schema

Reference for `.claude/memory/trace-log.jsonl` records. Append-only JSONL written by `append-trace.sh`.

## Top-Level Fields

| Field | Type | Required | Source |
|---|---|---|---|
| `schema_version` | string | yes | always `"1.0"` (current) |
| `ts` | string | yes | ISO 8601 UTC timestamp `YYYY-MM-DDTHH:MM:SSZ` |
| `event` | string | yes | one of the canonical event types below |
| `run_id` | string | optional | `MEOWKIT_RUN_ID` env var (set by `mk:harness` step-00) |
| `harness_version` | string | yes | `MEOWKIT_HARNESS_VERSION` env var, default `"3.0.0"` |
| `model` | string | optional | `MEOWKIT_MODEL_HINT` or `CLAUDE_MODEL` env var |
| `density` | string | optional | `MEOWKIT_HARNESS_MODE` env var (`MINIMAL\|FULL\|LEAN`) |
| `data` | object | yes | event-specific payload (see Event Types below) |

## Canonical Event Types

| Event | Emitter | Payload schema |
|---|---|---|
| `file_edited` | `learning-observer.sh` | `{file: str, edit_count: int}` |
| ~~`build_verify_result`~~ | **DEPRECATED (v2.4.0)** — `.sh` emitter removed; `handlers/build-verify.cjs` does NOT re-emit | `{file: str, exit_code: int, command: str}` (historical only) |
| ~~`loop_warning`~~ | **DEPRECATED (v2.4.0)** — `.sh` emitter removed; `handlers/loop-detection.cjs` does NOT re-emit | `{file: str, count: int, threshold: 4 \| 8}` (historical only) |
| `harness_run_start` | `mk:harness` step-00 | `{task: str, density: str, model: str, run_id: str}` |
| `contract_signed` | `mk:sprint-contract` sign action | `{slug: str, sprint: int, generator_sha: str, evaluator_sha: str}` |
| `verdict_written` | `mk:evaluate` step-04 | `{slug: str, overall: str, weighted_score: float, hard_fail: bool, evidence_count: int}` |
| `cost_sample` | `budget-tracker.sh` | `{step: str, usd: float, cumulative_usd: float}` |
| `session_end` | `post-session.sh` | `{duration_seconds: int, total_cost_usd: float, error_count: int}` |
| `dead_weight_audit_needed` | `post-session.sh` (model change) | `{old_model: str, new_model: str}` |
| `benchmark_result` | `mk:benchmark/scripts/run-canary.sh` (inline at manifest write — see C2 fix 260408) | `{run_id: str, tier: str, model: str, manifest_path: str}` |

## Trace Ownership (Phase 8 P23)

Each event type has exactly ONE canonical emitter. No double-emission across hooks:

- `learning-observer.sh` is the only emitter of `file_edited`
- ~~`post-write-build-verify.sh`~~ removed v2.4.0; `build_verify_result` is no longer emitted (verify-result feedback now via stdout, not trace)
- ~~`post-write-loop-detection.sh`~~ removed v2.4.0; `loop_warning` is no longer emitted (warn/escalate now via stdout markers `@@LOOP_DETECT_WARN@@` / `@@LOOP_DETECT_ESCALATE@@`)

This prevents trace inflation from redundant records.

## Field Conventions

- **Timestamps:** always UTC, ISO 8601 with `Z` suffix
- **File paths:** prefer relative-to-project-root; absolute paths only when context requires
- **Costs:** USD as float (2 decimal places)
- **Verdict values:** `PASS` / `WARN` / `FAIL` / `ESCALATED` / `TIMED_OUT` (matches harness `final_status`)

## Secret Scrubbing

Every record passes through `lib/secret-scrub.sh` before write. Patterns redacted:
- OpenAI keys (`sk-...`)
- Anthropic keys (`sk-ant-...`)
- AWS access keys (`AKIA...`)
- GitHub tokens (`ghp_...`, `gho_...`)
- GitLab PATs (`glpat-...`)
- Slack tokens + webhooks
- JWTs
- Private key blocks
- Generic `key/password/secret/token=value` patterns

False positives are acceptable; missed secrets are not.

## Rotation

When `trace-log.jsonl` exceeds 50MB, `append-trace.sh` rotates it:
1. Move to `trace-log.{YYMMDD-HHMMSS}.jsonl`
2. gzip in place → `trace-log.{YYMMDD-HHMMSS}.jsonl.gz`
3. Truncate the original

Rotated logs remain in `.claude/memory/` for historical analysis. They are NOT deleted automatically.

## Reading Records

Always parse via `.claude/skills/.venv/bin/python3` (per kit rules §4 — no `jq` dependency):

```python
import json
with open('.claude/memory/trace-log.jsonl') as f:
    for line in f:
        if not line.strip():
            continue
        record = json.loads(line)
        # ... process record
```

`mk:trace-analyze` uses this pattern in `step-01-ingest.md`.

## Append-Only Discipline

Records are NEVER mutated after write. Corrections come as new records with a `correction_for` field referencing the original `ts`+`event`. The append-only invariant lets the trace log serve as an audit trail for the dead-weight audit playbook.

## Schema Versioning

The current schema is `1.0`. Future schema bumps:
- **MINOR (1.1)**: add optional fields → consumers must default-handle missing fields
- **MAJOR (2.0)**: rename or remove fields → consumers must filter by `schema_version`

`mk:trace-analyze/step-01-ingest.md` filters records by `schema_version` and warns on unknown versions.
