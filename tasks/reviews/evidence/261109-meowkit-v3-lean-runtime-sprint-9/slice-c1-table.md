# Slice C1 — non-integration skill metadata, batch 1 of 2

Scope: the `description` and `when_to_use` frontmatter scalars of **51** non-integration
`.claude/skills/<name>/SKILL.md` files. No other frontmatter key, no body text, no agent, no rule,
no integration block, no spec, no validator, no generated surface. **Nothing committed.**

HEAD at slice start = `3f85e7ff`. A second agent rewrote a disjoint skill set in the same working
tree concurrently; every figure below is measured over this slice's 51 files only, "before" taken
from `git show HEAD:<path>`.

## Measurement method

The extractor inside `scripts/check-always-on-budget.cjs` (`measureMetadata`): each file's
frontmatter YAML-parsed, `Buffer.byteLength` over the **scalar values** of `name` + `description` +
`when_to_use`. Never a line or regex match. Per-block budget for a non-integration skill: **280 B**
including the immovable `name`.

## Shape of the rewrite

- **`description`** = the job in one clause, then one explicit exclusion clause
  `NOT for <mk:id>.` naming the nearest neighbour the skill is confused with. No marketing, no
  sub-feature list, no example strings, no multi-line "Do NOT use …" stack. The distinguishing
  verbs and nouns a user actually types are kept (e.g. `rm -rf`, `DROP TABLE`, `llms.txt`,
  `angular.json`, `file:line`, `MP4`, `CDP`).
- **`when_to_use`** = one concrete trigger — the observable situation, not a restatement of the
  description. Mechanically checked: neither field contains the other, and no two of the 129
  skills in the tree share a `description` or a `when_to_use`.
- Every edit is confined to those two scalars. Verified per file: the parsed frontmatter key
  **set** is identical to `HEAD` and every other key (`name`, `version`, `preamble-tier`,
  `allowed-tools`, `hooks`, `source`, `keywords`, `owner`, `criticality`, `status`, `runtime`,
  `phase`, `trust_level`, `injection_risk`, `user-invocable`, `argument-hint`, `license`,
  `original_skills`, …) is deep-equal to `HEAD` — **0 violations over 51 files**.
  `git diff --name-status` over the 51 shows only `M`: no add, rename or delete.

## Per-block before/after bytes and exclusion target

| block | before B | after B | delta | exclusion target |
|---|---|---|---|---|
| `mk:advise` | 1425 | 244 | -1181 | `mk:party` |
| `mk:agent-browser` | 750 | 209 | -541 | `mk:chrome-profile` |
| `mk:agent-detector` | 355 | 200 | -155 | `mk:scale-routing` |
| `mk:angular` | 447 | 190 | -257 | `mk:typescript` |
| `mk:api-design-principles` | 615 | 244 | -371 | `mk:backend-development` |
| `mk:arch` | 648 | 238 | -410 | `mk:improve-codebase-architecture` |
| `mk:ask-me` | 925 | 212 | -713 | `mk:investigate` |
| `mk:autobuild` | 663 | 204 | -459 | `mk:cook` |
| `mk:backend-development` | 734 | 227 | -507 | `mk:api-design-principles` |
| `mk:bootstrap` | 634 | 209 | -425 | `mk:autobuild` |
| `mk:brainstorming` | 376 | 203 | -173 | `mk:office-hours` |
| `mk:breakdown` | 639 | 198 | -441 | `mk:planning-engine` |
| `mk:build-fix` | 419 | 181 | -238 | `mk:fix` |
| `mk:careful` | 635 | 209 | -426 | `mk:freeze` |
| `mk:chom` | 604 | 190 | -414 | `mk:web-to-markdown` |
| `mk:chrome-profile` | 790 | 209 | -581 | `mk:agent-browser` |
| `mk:clean-code` | 445 | 191 | -254 | `mk:simplify` |
| `mk:context-audit` | 802 | 197 | -605 | `mk:context-engineering` |
| `mk:context-engineering` | 929 | 226 | -703 | `mk:context-audit` |
| `mk:cook` | 595 | 190 | -405 | `mk:autobuild` |
| `mk:cso` | 634 | 202 | -432 | `mk:vulnerability-scanner` |
| `mk:database` | 651 | 189 | -462 | `mk:api-design-principles` |
| `mk:decision-framework` | 332 | 198 | -134 | `mk:party` |
| `mk:delegate` | 617 | 214 | -403 | `mk:team-config` |
| `mk:development` | 290 | 183 | -107 | `mk:cook` |
| `mk:devops` | 616 | 185 | -431 | `mk:ship` |
| `mk:docs-finder` | 856 | 208 | -648 | `mk:web-to-markdown` |
| `mk:docs-init` | 452 | 166 | -286 | `mk:document-release` |
| `mk:document-release` | 560 | 199 | -361 | `mk:docs-init` |
| `mk:elicit` | 575 | 205 | -370 | `mk:review` |
| `mk:evaluate` | 363 | 190 | -173 | `mk:review` |
| `mk:figma` | 857 | 197 | -660 | `mk:stitch` |
| `mk:fix` | 431 | 177 | -254 | `mk:investigate` |
| `mk:freeze` | 576 | 176 | -400 | `mk:careful` |
| `mk:frontend-design` | 333 | 189 | -144 | `mk:ui-design-system` |
| `mk:ghpm` | 686 | 176 | -510 | `mk:review-pr` |
| `mk:grill` | 1208 | 204 | -1004 | `mk:advise` |
| `mk:help` | 475 | 163 | -312 | `mk:status` |
| `mk:henshin` | 699 | 224 | -475 | `mk:skill-creator` |
| `mk:html-video` | 651 | 203 | -448 | `mk:multimodal` |
| `mk:improve-codebase-architecture` | 871 | 190 | -681 | `mk:arch` |
| `mk:intake` | 450 | 205 | -245 | `mk:breakdown` |
| `mk:investigate` | 680 | 168 | -512 | `mk:fix` |
| `mk:lazy-agent-loader` | 276 | 167 | -109 | `mk:agent-detector` |
| `mk:lint-and-validate` | 428 | 163 | -265 | `mk:verify` |
| `mk:llms` | 293 | 162 | -131 | `mk:docs-init` |
| `mk:loop` | 582 | 202 | -380 | `mk:evaluate` |
| `mk:markdown-reader` | 710 | 191 | -519 | `mk:preview` |
| `mk:memory` | 501 | 188 | -313 | `mk:retro` |
| `mk:mermaidjs-v11` | 500 | 193 | -307 | `mk:tech-graph` |
| `mk:multimodal` | 524 | 200 | -324 | `mk:html-video` |
| **51 blocks** | **31107** | **10048** | **-21059** | |

## Against the budget

| figure | target | measured | verdict |
|---|---|---|---|
| largest single block | ≤ 280 B | **244 B** (`mk:advise`, `mk:api-design-principles`) | PASS |
| blocks over 280 B | 0 | **0 of 51** | PASS |
| 51-block total | — | **10 048 B**, from **31 107 B** | **−21 059 B** |
| per-block average | 280 B budget | **197.0 B** actual | PASS, 83 B/block spare |
| exclusion clauses present | 51 | **51 of 51**, none omitted | PASS |
| exclusion ids resolving | 51 | **51 of 51** resolve to a `.claude/skills/<dir>` | PASS |

Nothing in this slice was saved by deleting a field: all 51 keep a non-empty `name`,
`description` **and** `when_to_use`. No block excludes itself.

## Checks run on the tree after this slice

| Check | Result |
|---|---|
| `node scripts/check-always-on-budget.cjs .` | **exit 0** — rules 25 417 B (limit 25 600), always-listed **59 401 B** (limit 70 000), 10 599 B headroom |
| `node packages/mewkit/dist/index.js validate --frontmatter` | exit 0 — `[PASS] Skill frontmatter` |
| `bash scripts/check-skill-cross-refs.sh` | exit 0 — all skill and local entrypoint refs resolve |
| frontmatter key isolation, 51 files vs `HEAD` | 0 violations |
| changed-file set | 51 of 51 mine dirty, all `M`; every other dirty `.claude` path belongs to the concurrent slice |
| duplicate `description` / `when_to_use` across **129** skills | **0** duplicates, 0 empty, 0 restating `name` |
| `NOT for mk:*` id resolution over the 51 blocks | 51 clauses, **0** unresolved |
| neither field contains the other, per block | 0 violations |

The always-listed total reads **59 401 B** rather than this slice's own contribution because the
concurrent slice's rewrite is present in the same working tree. The rules subtotal is unchanged at
**25 417 B** (`git diff -- .claude/rules/` is empty for this slice) — no byte of this cut was paid
for out of the always-on rules.

## Notes for the orchestrator

1. **Not committed, and no generator run.** `packages/docs/docs-reference-manifest.json` and the
   generated reference-index blocks are now stale for these 51 `description` values;
   `scripts/docs-manifest.cjs --check` will report them until the later regeneration step runs
   `--write`. Deliberate: a `--write` here would race the concurrent slice.
2. **Routing information deliberately dropped**, recorded so a reader does not read it as loss:
   `mk:agent-detector` no longer states "not user-callable directly"; `mk:markdown-reader` no
   longer states it is a dependency of no other skill; `mk:figma` no longer states it is read-first
   with gated advanced operations; `mk:cso` no longer names its daily/comprehensive modes;
   `mk:advise` and `mk:grill` each kept **one** of their four previous exclusion targets. In every
   case the dropped text is still in the skill body, which is not always-listed.
3. **Exclusion targets are the nearest confusable neighbour, not necessarily reciprocal.**
   `mk:advise` ↔ `mk:grill`, `mk:fix` ↔ `mk:investigate`, `mk:careful` ↔ `mk:freeze`,
   `mk:docs-init` ↔ `mk:document-release`, `mk:context-audit` ↔ `mk:context-engineering` and
   `mk:agent-browser` ↔ `mk:chrome-profile` are reciprocal pairs; the rest point one way at the
   skill that wins the request instead.
4. **`mk:lazy-agent-loader` is a deprecated shim** and its rewritten text says so, pointing at
   `mk:agent-detector`. Its `status` key was not touched.
