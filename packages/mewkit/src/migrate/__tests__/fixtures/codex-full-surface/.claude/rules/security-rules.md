# Security Rules

<!-- ref: inline-mapped-asset -->
These rules extend .claude/rules/security-rules.md conventions from the base kit.

<!-- ref: inline-unmapped-runtime -->
Audit findings are appended to .claude/memory/security-log.json.

<!-- ref: fenced-illustrative-example -->
Never commit secrets. Example of a blocked write:

```bash
echo "API_KEY=sk-123" >> .env
```

<!-- ref: claude-md-token-prose -->
Overrides must be documented in CLAUDE.md.
