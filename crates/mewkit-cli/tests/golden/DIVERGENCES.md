# Intended divergences from the TS baseline

`ts-baseline/*.manifest.json` record what `mewkit init --target <t> --yes` (npm CLI)
writes today, produced by `node scripts/capture-ts-baseline.mjs` from this
checkout's git-tracked kit. They are a reference, not a contract: `mewkit-next`
must match them or list the difference here, with the decision behind it.

Regenerate after any change to the kit or the npm CLI's install path, and check
with `node scripts/capture-ts-baseline.mjs --check` (needs `npm run build`).

| Target | Path(s)     | TS behaviour | mewkit-next                                      | Decision                             |
| ------ | ----------- | ------------ | ------------------------------------------------ | ------------------------------------ |
| cursor | `AGENTS.md` | written      | not written; Cursor gets its own `.cursor/` tree | plan.md user decision 5 (2026-11-10) |

Regeneration is manual and not gated in CI: the kit changes often and every
change moves thousands of digests. A CI job must exist before any phase claims
parity from these manifests.
