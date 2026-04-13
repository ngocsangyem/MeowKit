# Confluence MCP Tools — 6-Tool Subset

Used by meow:confluence agents. Verified from mcp-atlassian source.

| Tool | Params | Returns | Notes |
|------|--------|---------|-------|
| `search` | `query` (CQL or text), `limit` (1-50, def:10), `spaces_filter` | JSON list of pages | CQL for complex; plain text with fallback |
| `get_page` | `page_id` OR (`title` + `space_key`), `convert_to_markdown` (bool), `include_metadata` (bool) | Page content + metadata | Use `convert_to_markdown=true` for token efficiency |
| `get_page_children` | `parent_id`, `include_content` (bool), `convert_to_markdown` (bool), `limit` (1-50) | JSON array of child pages | Flat list with depth — recursion needed for grandchildren |
| `get_comments` | `page_id` | JSON list of comments | Page-level only; no deep threading |
| `get_attachments` | `content_id`, `limit` (1-100, def:50), `filename` (exact match), `media_type` (MIME) | Attachment metadata list | MIME often `application/octet-stream` — use filename filter |
| `get_page_images` | `content_id` | List of ImageContent (base64) | PNG/JPEG/GIF/WebP/SVG; max 50MB each; SEPARATE from get_page |

## Key Gotchas

- `get_page` does NOT include images — must call `get_page_images` separately
- `get_page_children` is flat — use recursive calls for depth > 2
- Markdown conversion is lossy on macros (Jira tables, status badges → empty)
- 50MB cap on attachment/image downloads
- `convert_to_markdown=false` returns raw HTML/storage format (escape hatch for macros)
