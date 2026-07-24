# Attachment Conventions

How Confluence attachments behave on Cloud, what the wrapper enforces, and naming / size conventions to follow.

## Contents

- [Size Limits](#size-limits)
- [Allowed Types](#allowed-types)
- [Path Validation](#path-validation)
- [Download Paths + Cleanup](#download-paths--cleanup)
- [Naming Conventions](#naming-conventions)

## Size Limits

- Confluence Cloud default per-attachment limit: **100 MB**
- Total attachments per page: no hard cap (degraded UX above ~50 attachments)
- Tenant-level admins may lower the per-attachment limit

If `attachment upload` fails with size-related errors:

```
Result: failed
Reason: Attachment exceeds tenant size limit
```

…ask the user whether to compress (image) / split (video) / link externally (Drive, S3) instead.

## Allowed Types

Confluence Cloud accepts most common file types. Special handling notes:

| Type group | Examples | Notes |
|---|---|---|
| Images | png, jpg, gif, svg, webp | Inline-rendered on page; safe to use as figures |
| Documents | pdf, docx, xlsx, pptx | Renderable preview in Confluence UI |
| Video | mp4, mov, webm | Player embedded in UI |
| Archives | zip, tar.gz, 7z | Stored, downloadable; no preview |
| Source | py, js, ts, sh, etc. | Treated as plain text; no syntax highlighting in preview |
| Executables | exe, dmg, app | Allowed but flagged by some tenants — confirm before uploading |

## Path Validation

The agent validates paths at the agent boundary AND `confluence-as` validates internally:

1. **Agent boundary check:**
   - Reject paths containing `..` traversal
   - Reject absolute paths outside `$(git rev-parse --show-toplevel)` and explicitly allowlisted ephemeral prefixes (`/tmp/conf-*`, `/var/folders/`)
   - Reject paths to sensitive files (`*.env`, `~/.ssh/*`, `*.pem`, `*credentials*`, `*secret*`) per `injection-rules.md` Rule 4

2. **Wrapper boundary check:** `confluence-as` calls `validate_file_path` which delegates to `assistant_skills_lib`. Treat as defense-in-depth — do not rely on it as the sole gate.

If either check rejects the path, surface the error to the user and stop.

## Download Paths + Cleanup

Conventions for the agent when downloading attachments (e.g. for image analysis in spec-analyst):

- Use `/tmp/conf-attach-<aid>.<ext>` as the staging path
- Do NOT keep downloaded attachments after analysis — `rm` immediately to avoid orphaned bytes on disk
- Never download to project root or version-controlled paths

Example flow:

```bash
bash $(git rev-parse --show-toplevel)/.agents/skills/confluence/scripts/confluence-as.sh attachment download \
  --attachment-id 9876 --output /tmp/conf-attach-9876.png
# ... use the file ...
rm /tmp/conf-attach-9876.png
```

## Naming Conventions

When uploading new attachments:

- Use kebab-case filenames: `q3-roadmap-diagram.png`, not `Q3 Roadmap Diagram.png`
- Avoid special characters (`& % # @`) — they may break the URL or display
- Include version / date in name when iterating: `wireframes-v2-260510.png`
- Page-level uniqueness: a new upload with the same name as an existing attachment will create a new version of that attachment (not a duplicate file). Confirm before overwriting if unintentional.
