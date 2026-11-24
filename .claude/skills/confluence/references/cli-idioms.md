# mk:confluence — CLI Idioms

How leaves invoke the wrapper. Read first; the safe-invocation pattern is load-bearing.

## Contents

- [Safe invocation pattern](#safe-invocation-pattern) — load-bearing
- [Read-only ops](#read-only-ops)
- [CRUD ops](#crud-ops)
- [Search with sanitization](#search-with-sanitization)
- [JSON envelope](#json-envelope)
- [Error envelope + exit codes](#error-envelope--exit-codes)
- [Pagination](#pagination)
- [Local conversion helpers](#local-conversion-helpers)
- [Common gotchas](#common-gotchas)

## Safe invocation pattern

Always pass sanitized values as positional args. **Never** construct a command string and `eval` it. **Never** `bash -c "..."` with interpolated variables.

```bash
# SAFE — value is an argument; bash never re-evaluates it
bash "$WRAPPER" search cql "$SANITIZED_CQL"

# UNSAFE — never do this
eval "bash $WRAPPER search cql \"$SANITIZED_CQL\""
bash -c "bash $WRAPPER search cql \"$SANITIZED_CQL\""
```

Stored variable values do not trigger command substitution on simple expansion, but the safe pattern uses positional args + double-quoted variable expansion only. This is the entire interface — agents have no permission to construct command strings.

## Read-only ops

```bash
WRAPPER="scripts/confluence-as.sh"

bash "$WRAPPER" page get 12345 --body --format markdown
bash "$WRAPPER" space list --limit 50
bash "$WRAPPER" hierarchy children 12345
```

## CRUD ops

```bash
bash "$WRAPPER" page create --space DOCS --title "$TITLE" --body "$BODY"
bash "$WRAPPER" page update 12345 --title "$NEW_TITLE"
# moves the page to trash; --permanent cannot be undone
bash "$WRAPPER" page delete 12345
```

## Search with sanitization

User-derived input MUST flow through `cql-sanitize.sh` before it reaches the CQL string (reason: a term can otherwise close the quote and add clauses):

```bash
SANITIZER="scripts/cql-sanitize.sh"
SAFE=$(bash "$SANITIZER" "$USER_TERM") || {
  echo "rejected: $USER_TERM"; exit 1
}
bash "$WRAPPER" search cql "title ~ \"$SAFE\""
```

The sanitizer escapes backslash + double-quote in the payload; the caller is responsible for placing the value INSIDE quotes in the operator template.

## JSON envelope

Wrapper sets `CONFLUENCE_OUTPUT=json` by default. Output is the raw upstream API response — there is no envelope. Skills must parse with `python3 -c 'import json,sys; ...'` or `jq`.

If the upstream `print_success` line appears as a trailing non-JSON line, set `MEOW_CONFLUENCE_STDOUT_FILTER=trim-tail` in `.meowkit/.env`. See `references/install-and-auth.md` for the channel-detection smoke test.

## Error envelope + exit codes

| Code | Cause |
| ---- | ----- |
| 0    | Success |
| 1    | Sanitizer rejection |
| 2    | Plaintext credentials in `settings.local.json` |
| 3    | Non-Cloud URL |
| 4-7  | Upstream confluence-as errors (network, auth, validation, server) |
| 127  | Binary missing |

On non-zero exit: stderr carries the upstream error message. Skills should surface the message verbatim to the user, do NOT auto-retry destructive ops.

## Pagination

confluence-as uses cursor pagination. CLI commands handle paging internally and return aggregated results in JSON. For large result sets, pass `--limit N` (default upstream cap is 250). For very large sets, use `mk:confluence-bulk` with `--max-pages` cap.

## Local conversion helpers

`scripts/adf-to-md.sh` converts an ADF (Atlas Doc Format) JSON document to macro-aware Markdown. Two modes:

```bash
# stdin (no second fetch): pipe an ADF body in, get MD out
printf '%s' "$ADF_JSON" | bash "$ROOT/scripts/adf-to-md.sh"

# fetch-and-convert (--page-id): single round-trip via the wrapper
bash "$ROOT/scripts/adf-to-md.sh" --page-id 12345
```

Reverse direction (md → adf) is deferred — no current consumer calls
`page update --representation atlas_doc_format --content-file <json>`. Re-add
when a real consumer surfaces.

### Single-call fetch pattern (used by `mk:confluence-spec-analyst`)

`page get --representation atlas_doc_format` returns metadata + body in one
response — extract both with `jq` rather than making a second metadata call:

```bash
RAW=$(bash "$WRAPPER" page get --page-id "$ID" --representation atlas_doc_format)
META=$(printf '%s' "$RAW" | jq '{id, title, space: .space.key, version: .version.number}')
ADF=$(printf '%s' "$RAW" | jq -r '.body.atlas_doc_format.value' | jq '.')
MD=$(printf '%s' "$ADF" | bash "$ADF2MD")
```

### Macro label convention

Walker output uses ASCII labels so downstream LLM agents can grep them as first-class signals (no Unicode, no markdown-interpreted chars):

| ADF node | Markdown label | Notes |
|---|---|---|
| `panel` (panelType `info`/`warning`/`note`/`success`/`error`) | `> [INFO]` / `> [WARN]` / `> [NOTE]` / `> [OK]` / `> [ERROR]` | Body indented under blockquote |
| `decisionList` + `decisionItem` | `> [DECISION]` blockquote per item | NOT a bare `decision` node — list wraps items |
| `taskList` + `taskItem` (state `TODO`/`DONE`) | `- [ ]` / `- [x]` | GFM checklist |
| `expand` / `nestedExpand` | `<details><summary>{title}</summary>` | HTML fallback (markdown lacks native expand) |
| `mention` | `@{escaped-name}` + footnote at end | Display name escaped + injection-pattern scanned; redacted if matched |
| `media` / `mediaInline` / `mediaSingle` | `![alt](attachment:{id})` | All three variants registered |
| `inlineCard` / `blockCard` | `[title](url) [smart-card]` | Smart Link + Figma embeds |
| Unknown node | `[UNHANDLED_NODE: <type>]` + keys-only metadata block | Never raw text/attr values |

Fixture and expected output for development: `scripts/tests/fixtures/adf-macros.json` + `adf-macros.expected.md`.

## Common gotchas

- ADF round-trip is lossy on macros (panel / expand / mention / emoji / media / decision / task-list); re-saving through update may flatten them.
- POST is retried by the client, so a create on a flaky network can duplicate a page: list pages with the same title before retrying.
- The CLI binary is `confluence-as` (some upstream READMEs say `confluence`); the wrapper handles this.
- The global `--quiet` flag is declared but never read; do not depend on it.
