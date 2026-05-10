---
title: confluence-collaborate
description: Confluence collaboration agent — manages comments, attachments, labels, and watchers on individual pages via the confluence-as CLI wrapper.
---

# confluence-collaborate

The confluence-collaborate agent manages the per-page collaboration layer in Confluence Cloud — comments, attachments, labels, watchers — through the `confluence-as` CLI wrapper. It prefers footer comments over inline (because inline anchors require unique selection text), and it independently validates upload paths before delegating to the wrapper.

## Cognitive Framing

> *"One page, four collaboration surfaces. Footer-default for comments; path-validate for uploads."*

The confluence-collaborate agent folds four upstream skill domains (comment / attachment / label / watcher) into a single agent because they all share the same blast radius: per-page, reversible, but visible to the page's audience. The agent treats label add as Tier 2, label remove as Tier 3 (asymmetric — removing a label may have policy implications), and inline-comment posting as a confirm-before-execute action.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Confluence) |
| **Phase** | On-demand |
| **Model** | inherit |
| **Color** | cyan |
| **Safety** | Footer-default for comments; path validation for uploads; inline comments require user confirm |
| **Never does** | Page CRUD (confluence-page), bulk ops across ≥10 pages (confluence-bulk), spec analysis (confluence-spec-analyst) |

## When to Use

- When you need to **add / list / update / delete a comment** on a single page (footer or inline).
- When you need to **upload an attachment** to a page or **download** an existing attachment.
- When you need to **add or remove a label** on a single page (NOT bulk-label across many pages).
- When you need to **watch / unwatch** a page or **list watchers**.

## Key Capabilities

- **Comment management** — footer comments by default; inline comments require an anchor selection that uniquely matches page content.
- **Attachment upload + download** — file-size and MIME-type checks; download paths constrained to `$CLAUDE_PROJECT_DIR` or `/tmp/conf-*`.
- **Label CRUD** — add (Tier 2) and remove (Tier 3, asymmetric).
- **Watcher CRUD** — add / remove / list watchers per page.
- **Path-traversal guard** — independently validates `..` traversal at the agent boundary, even though `confluence-as` also validates.

## Behavioral Checklist

- [x] Prefers footer comments — confirms before posting an inline comment
- [x] Verifies the inline-comment anchor is unique on the page before posting
- [x] Validates upload paths are under `$CLAUDE_PROJECT_DIR` or an explicitly allowlisted `/tmp/conf-*` prefix
- [x] Rejects `..` traversal at the agent boundary, NOT just at the wrapper
- [x] Treats label-remove as Tier 3 (shows the page's current label set first)
- [x] Routes any request touching ≥10 pages to `confluence-bulk` instead of looping
- [x] Never writes comment bodies, file contents, or label names to memory

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Add comment to page 12345: 'awaiting backend fix'" | Posts a footer comment via `comment add --page-id 12345 --body "..."` |
| "List comments on page 12345" | `comment list --page-id 12345` with projected fields |
| "Attach /tmp/repro.mp4 to page 12345" | Validates path under `/tmp/`, runs `attachment upload --page-id 12345 --file ...` |
| "Label page 12345 as 'rfc'" | `label add --page-id 12345 --label rfc` |
| "Who watches page 12345?" | `watch list --page-id 12345` |
| "Bulk-label every page in ENG with 'archive'" | Refuses — routes the user to [`confluence-bulk`](/reference/agents/confluence-bulk) |

## Pro Tips

### Confluence Has No Strict internal/public Comment Flag

Unlike Jira Service Management (where comments have an explicit `internal` boolean), Confluence comments have no first-class internal/public toggle. Inline vs footer is the closest semantic boundary — footer comments are scoped to the page conversation; inline comments anchor to specific content. The agent prefers footer because the inline-anchor-uniqueness requirement is a fragile failure mode.

### Inline Anchors Must Be Unique

If the inline-comment selection text matches multiple positions on the page, the API rejects the comment with a 400-class error. The agent verifies uniqueness via a content scan before posting; on collision, it suggests a longer / more specific anchor selection.

### Bulk Belongs Elsewhere

Any request touching ≥10 pages is out of scope for this agent. Looping `label add` 47 times is a bypass of the dry-run ceremony — the agent refuses and routes the user to [`confluence-bulk`](/reference/agents/confluence-bulk), which has the proper safety-tier handling.

## Key Takeaway

The confluence-collaborate agent owns the per-page collaboration surface — comment, attachment, label, watcher — with footer-default discipline, path-traversal guards, and an explicit handoff to `confluence-bulk` when scope crosses the 10-page threshold.

## Related Agents

- **[confluence-page](/reference/agents/confluence-page)** — for page body / title CRUD (NOT collaboration surfaces)
- **[confluence-bulk](/reference/agents/confluence-bulk)** — for label / move / delete across ≥10 pages
- **[confluence-spec-analyst](/reference/agents/confluence-spec-analyst)** — downloads attachments via this agent's helper paths for image analysis
