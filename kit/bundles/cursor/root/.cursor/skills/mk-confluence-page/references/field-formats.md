# Confluence Page Field Formats

Quick reference for the body-content representations Confluence Cloud accepts and emits, and when to pass which.

## Contents

- [Representation Types](#representation-types)
- [ADF vs XHTML](#adf-vs-xhtml)
- [Choosing on Read](#choosing-on-read)
- [Choosing on Write](#choosing-on-write)
- [Round-Trip Caveats](#round-trip-caveats)

## Representation Types

| Representation | Description | Typical use |
|---|---|---|
| `storage` | XHTML-like canonical format used internally by Confluence Cloud | Authoritative read; programmatic edits |
| `view` | HTML render produced by the page renderer | Display-only; do NOT round-trip |
| `export_view` | HTML for export pipelines (PDF / Word) | Reports, exports |
| `wiki` | Legacy wiki markup (deprecated; not all instances expose) | Avoid |
| `atlas_doc_format` (ADF) | JSON document tree used by the v2 API | Programmatic edits where the storage format is too brittle |

## ADF vs XHTML

- **ADF** (`atlas_doc_format`) is a JSON tree. Canonical for newer Confluence APIs and the format used by the comment endpoint and many newer macros.
- **XHTML** (`storage`) is the long-standing on-disk format. Many programmatic edits still go through `storage`.

The `confluence-as` library converts internally; user-supplied markdown is normalized before issuing the create/update request. Avoid hand-editing storage XHTML — its parser is regex-based and malformed nesting fails silently.

## Choosing on Read

- For programmatic comparison or diff: request `--representation storage`
- For human-readable rendering: request `--representation view`
- For an exported (PDF / Word) bundle: request `--representation export_view`

## Choosing on Write

- For markdown-style content: pass `--content '<markdown>'` and let the wrapper convert
- For raw storage XHTML (rare): pass `--representation storage --content '<xhtml>'`
- For raw ADF (rare; only when you have a known-good JSON document): pass `--representation atlas_doc_format --content-file <file.json>`

## Round-Trip Caveats

- ADF round-trip is **lossy** on these node types: panel, expand, mention, emoji, media, decision, task-list. Re-saving a page containing these macros via update may flatten them.
- `storage` round-trip is more robust but the regex-based parser in `confluence-as` may corrupt malformed or deeply nested input.
- For pages containing macros, prefer `page get --representation storage` then surgical edit, rather than fetching `view` and trying to round-trip.
- Always inspect a diff (current → proposed) before calling `page update` on a macro-heavy page.

## See also

- `confluence/references/cli-idioms.md#local-conversion-helpers` — `adf-to-md.sh` walker for read-side macro preservation (panel / decision / task-list / expand / mention / media / inlineCard surface as labelled markdown).
