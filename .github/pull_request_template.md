## Summary

<!-- What does this PR do, and why? 1-2 sentences. -->

## Type

- [ ] Bug fix
- [ ] Skill (`mk:*`), agent, rule or hook
- [ ] CLI (`crates/`)
- [ ] Runtime overlay (`kit/overlays/`)
- [ ] Documentation
- [ ] Refactor (no behavior change)
- [ ] CI / release tooling

## Changes

<!-- The key changes, with file links. -->

-

## Testing

<!-- Tick what you ran. CONTRIBUTING.md lists every CI check and how to fix it. -->

- [ ] `npm run lint` and `npm test`
- [ ] Rust (if `crates/`, `Cargo.*` or `.claude/hooks/` changed): `cargo fmt --all --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, `cargo test --workspace --locked`
- [ ] Kit (if `.claude/` or `kit/overlays/` changed): `mewkit validate`, `node scripts/check-skills-portable.cjs`, `node scripts/check-instruction-criteria.cjs --baseline scripts/instruction-criteria-baseline.json`
- [ ] Docs (if `packages/docs/` changed): `cd packages/docs && npm run check && npm run build`
- [ ] Generated files re-blessed and the diff reviewed (`MEWKIT_BLESS=1 cargo test …`), if a bless test failed
- [ ] Manual check: <!-- describe -->

## Checklist

- [ ] Skill and agent changes are in `.claude/`, not in a generated runtime copy
- [ ] New skill: kebab-case folder, `name: mk:<name>`, trigger-oriented description, Gotchas section, listed in every `kit/overlays/*/catalog/skill-packs.json`
- [ ] Shipped text names no file an install does not have, and no product name as a subject
- [ ] User-visible change: entry under `## Unreleased` in `packages/docs/content/docs/changelog/index.mdx`, and the docs page updated
- [ ] No secrets, `.env` values or credentials

## Related Issues

<!-- Closes #N, Fixes #N, or Related to #N -->
