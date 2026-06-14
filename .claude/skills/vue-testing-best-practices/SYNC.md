# Sync / Provenance

This skill was ported and extended to this toolkit's conventions from an upstream Vue
testing-best-practices skill.

- **Upstream origin:** `https://github.com/vuejs-ai/skills/tree/main/skills/vue-testing-best-practices`
- **Pinned commit:** `f3dd1bf4d3ac78331bdc903e4519d561c538ca6a`
- **Ported:** 2026-06-14

## Vendored-Verbatim References (11)

Ported byte-for-byte from the pinned commit. Refresh by diffing against upstream; do not
hand-edit (re-apply upstream changes instead). Upstream per-file frontmatter and code
patterns are preserved intentionally — no ToC was injected so the verbatim mirror stays clean.

- `reference/async-component-testing.md`
- `reference/teleport-testing-complexity.md`
- `reference/testing-async-await-flushpromises.md`
- `reference/testing-browser-vs-node-runners.md`
- `reference/testing-component-blackbox-approach.md`
- `reference/testing-composables-helper-wrapper.md`
- `reference/testing-e2e-playwright-recommended.md`
- `reference/testing-no-snapshot-only.md`
- `reference/testing-pinia-store-setup.md`
- `reference/testing-suspense-async-components.md`
- `reference/testing-vitest-recommended-for-vue.md`

## Additions (not upstream — preserve across re-sync)

Authored for this toolkit. An upstream re-sync MUST NOT delete these:

- `SKILL.md` — Toolkit frontmatter, routing table, invocation decision guide, workflow,
  output contract (the **Vue Testing Review**), and gotchas. Upstream had only a lookup table.
- `reference/vue-router-testing.md`
- `reference/form-testing.md`
- `reference/accessibility-testing.md`
- `reference/test-smells-rubric.md`
- `SYNC.md` (this file)

## Adaptation Notes

- Positioned as a **complement** to `mk:vue-best-practices`: that skill owns Vue _feature_
  code review/authoring; this one owns Vue _test_ design + test-code review. Read-only tool
  set (`Read`/`Grep`/`Glob`) — it advises and reviews, never runs/generates/fixes tests.
- Added the five pieces upstream lacked: non-responsibilities, workflow, validation rubric
  (`test-smells-rubric.md`), output contract, and ecosystem handoffs.
- Filled domain gaps absent upstream: Vue Router testing, form testing, accessibility-in-tests.
- Tooling stance preserved from upstream: recommend Vitest / `@vue/test-utils` / Playwright /
  `@pinia/testing`; discourage Jest for new Vue 3, snapshot-only tests, and
  `@testing-library/vue` for Suspense.

## Sync-Drift Strategy

There is **no automated directory-overwrite sync pipeline** in this repo (verified: the only
`sync` script is `scripts/sync-package-versions.cjs` for npm versions; no `.syncignore` or
`mewkit sync` directory mirror exists). Re-syncing is a **manual diff-and-re-apply** process,
identical to the sibling `mk:vue-best-practices` (`SOURCE.md`):

1. Diff the 11 vendored-verbatim references above against the pinned upstream commit.
2. Re-apply upstream changes to those 11 files; bump the pinned commit.
3. Leave every file in **toolkit Additions** untouched.

Because nothing overwrites the directory automatically, this manifest (vendored vs local) is
the protection — a re-sync diff that respects the two lists above cannot lose local work.

## Re-Sync Guidance

To refresh against upstream: diff the vendored references against the pinned commit, re-apply
upstream changes, bump the pinned commit, and confirm the toolkit files are intact.
