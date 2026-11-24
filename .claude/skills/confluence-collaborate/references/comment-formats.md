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

`comment add <page-id> "<body>"` (or `--file <path>` for a longer body) takes markdown, which the CLI converts to storage format. Markdown is sufficient and most reliable for everyday comments (text, code blocks, lists, links). Do not hand-write storage XHTML: its parser is regex-based and malformed nesting fails silently.

## ADF Edge Cases

ADF nodes such as panel, expand, mention, emoji, media, decision and task-list are lossy when a body is read and written back. The converter cannot represent them, so if a comment you read contains them, re-author the body cleanly instead of round-tripping it.

## Recommended Defaults

| Scenario | Recommendation |
|---|---|
| Quick text comment | Markdown as the `BODY` argument |
| Multi-line with code blocks | Markdown via `--file <file.md>` |
| Posting an analysis report (multi-section) | Markdown — it converts cleanly to storage format |
