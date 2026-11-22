# Gotchas

Update when bootstrap fails in new scenarios.

- **Over-scaffolding**: 20+ files for a simple project bury the user in code they did not need. Ask about scope first and match generated files to `config.json`.
- **Context overflow on large stacks**: a NestJS monorepo in one shot loses coherence. Generate the structure first, then one module at a time, checking compilation between steps.
- **Wrong naming conventions**: CamelCase files in a TypeScript project. Use the conventions in `scaffolding-principles.md`; ask if the stack is unknown.
- **Placeholder leak**: `[PROJECT_NAME]` or `[TODO]` left in files; `validate-bootstrap.sh` catches these, so fix them before declaring BOOTSTRAP_VALID.
- **Stale scaffold patterns**: boilerplate from an old framework version. Check current docs with `mk:docs-finder` rather than hardcoding.
- **Broken imports after generation**: generate in dependency order and the entry point last, since it imports everything.
- **Skipping research on "simple" projects**: they hide auth, state and deployment complexity, so research unless `--fast`.
- **Tiny scripts through the full pipeline**: under 5 files expected, use `--fast`.
