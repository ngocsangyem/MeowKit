---
name: meow:documentation
description: "Use when updating documentation after code changes, generating changelogs, or syncing API docs. Activates during Phase 6 (Reflect) or on explicit doc requests."
---

# Documentation Toolkit

Reference guides for documentation: living docs maintenance, API synchronization, and changelog generation.

## When to Use

- During Phase 6 (Reflect) for post-ship documentation updates
- When the `documenter` agent needs documentation patterns
- After code changes that require docs updates (API changes, new features)

## Workflow Integration

Operates in **Phase 6 (Reflect)**. Output supports the `documenter` agent.

## References

| Reference | When to load | Content |
|-----------|-------------|---------|
| **[living-docs.md](./references/living-docs.md)** | Docs maintenance | Keeping documentation in sync with code changes |
| **[api-sync.md](./references/api-sync.md)** | API changes | Synchronizing API documentation with endpoint changes |
| **[changelog-gen.md](./references/changelog-gen.md)** | Release time | Generating changelog entries from commit history |

## Gotchas

- **Docs drifting from code silently**: No automated check that docs match current implementation → Run docs:sync after every feature ship, not just when remembered
- **Auto-generated docs overwriting manual edits**: Regenerating API docs clobbers hand-written examples → Use separate files for generated vs curated content
