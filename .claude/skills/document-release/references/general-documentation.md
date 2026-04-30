# General Documentation Reference

Use `/mk:document-release` for post-ship doc sync.

## When to Use

- During Phase 6 (Reflect) for post-ship documentation updates
- When the `documenter` agent needs documentation patterns
- After code changes that require docs updates (API changes, new features)

## References (load on demand)

| Reference | When to load | Content |
|-----------|-------------|---------|
| **living-docs.md** | Docs maintenance | Keeping documentation in sync with code changes |
| **api-sync.md** | API changes | Synchronizing API documentation with endpoint changes |
| **changelog-gen.md** | Release time | Generating changelog entries from commit history |

## Gotchas

- **Docs drifting from code silently**: No automated check that docs match current implementation → Run docs:sync after every feature ship, not just when remembered
- **Auto-generated docs overwriting manual edits**: Regenerating API docs clobbers hand-written examples → Use separate files for generated vs curated content
