# Comment Formats

How Confluence comments work and what formats `confluence-as` accepts.

## Contents

- [Footer vs Inline](#footer-vs-inline)
- [Markdown vs Storage Format](#markdown-vs-storage-format)
- [ADF Edge Cases](#adf-edge-cases)
- [Recommended Defaults](#recommended-defaults)

## Footer vs Inline

| Type | UX | Persistence | Visibility |
|---|---|---|---|
| Footer | Threaded list at the bottom of the page | Always visible | All page readers |
| Inline | Anchored to a text selection; surfaces as an annotation marker | Always visible; highlighted on hover | All page readers |

Inline comments are visually intrusive — they create a yellow highlight on the anchor text and a marker in the right gutter. Posting an inline comment without the user's intent feels like a heavy touch.

**Default:** post as footer comment unless the user explicitly asks for inline.

## Markdown vs Storage Format

`confluence-as` accepts:

- **Markdown** (default for `--body "<text>"`) — auto-converted server-side by the wrapper
- **Storage format (XHTML-like)** — pass with `--representation storage` if you have a known-good payload
- **ADF** (`atlas_doc_format`) — pass `--representation atlas_doc_format --content-file <file.json>` for complex blocks

For everyday team comments (text, code blocks, lists, links), markdown is sufficient and most reliable.

## ADF Edge Cases

These ADF nodes are **lossy** when round-tripped (read-then-write):

- `panel` (info / warning / note callouts)
- `expand` (collapsible section)
- `mention` (`@user` references)
- `emoji` (custom or Slack-style)
- `media` (embedded images via media nodes, distinct from regular attachments)
- `decision` / `task-list` (Confluence-specific blocks)

If a comment you read contains any of these, do not round-trip the body through update — re-author the body cleanly. The regex-based XHTML parser in `confluence-as` may also misinterpret deeply nested or malformed storage XHTML, so prefer simple markdown for fresh comment bodies.

## Recommended Defaults

| Scenario | Recommendation |
|---|---|
| Quick text update | Markdown via `--body "..."` |
| Multi-line with code blocks | Markdown via `--body-file <file.md>` |
| Complex blocks (callouts, mentions) | ADF via `--representation atlas_doc_format --content-file <file.json>` (only when you have a known-good payload) |
| Posting an analysis report (multi-section) | Markdown — it converts cleanly to storage format |
