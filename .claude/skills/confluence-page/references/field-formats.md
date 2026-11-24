# Confluence Page Field Formats

Body formats the CLI reads and writes, and which to use when.

## Read

`page get <id> --body --format storage|view|markdown` (default `storage`).

| Format | What it is | Use |
|---|---|---|
| `storage` | XHTML-like canonical format | Authoritative read; surgical edits |
| `view` | Rendered HTML | Display only; do not round-trip |
| `markdown` | Markdown conversion | Reading; fresh-body drafts |

## Write

`page create` and `page update` take `--body "<markdown or XHTML>"` or `--file <path>`.

Which advice applies:

- **Fresh body** (new page, or replacing a body wholesale): write markdown and let the CLI convert. Do not hand-write storage XHTML; its parser is regex-based and malformed nesting fails silently.
- **Macro-heavy existing page** (panel, expand, mention, decision, task-list): read it with `--format storage`, change only the lines you need, and show the user the diff (current to proposed) before `page update`.

## Round-trip caveat

ADF round-trip is lossy on panel, expand, mention, emoji, media, decision and task-list nodes: re-saving a page that has them can flatten them. The read-side helper `adf-to-md.sh` in the confluence skill's `scripts/` keeps those macros as labelled markdown for reading.
