# Gotchas

Update when bootstrap fails in new scenarios.

- **Duplicating CLI init**: generating .claude/ files that create-meowkit already provides → NEVER touch .claude/; bootstrap owns src/ and tests/ only
- **Over-scaffolding**: generating 20+ files for a simple project → ask user about scope first; match generated files to actual needs in config.json
- **Context overflow on large stacks**: generating NestJS monorepo in one shot → progressive generation: structure first, then one module at a time; verify compilation between steps
- **Wrong naming conventions**: CamelCase files in TypeScript project → always check naming-rules.md for detected stack; ask user if stack is unknown
- **Placeholder leak**: `[PROJECT_NAME]` or `[TODO]` left in generated files → validate-bootstrap.sh catches these; fix before declaring BOOTSTRAP_VALID
- **Stale scaffold patterns**: generating patterns from outdated framework versions → use meow:docs-finder to check current framework docs before generating; don't hardcode framework boilerplate
- **Broken imports after generation**: files reference modules that don't exist yet → generate in dependency order; entry point last (it imports everything)
