# Slice C2 — per-block table

Scope: the `description` and `when_to_use` frontmatter of **53** non-integration shipped skills.
Nothing else in any of the 53 files was touched: for each file the parsed frontmatter **key set** is
identical to `HEAD`, every other key is byte-equal, and the body after the frontmatter is byte-equal —
**0 violations over 53 files**. Nothing is committed by this slice.

Measured with the extractor in `scripts/check-always-on-budget.cjs` — frontmatter YAML-parsed,
`Buffer.byteLength` over the scalar values of `name` + `description` + `when_to_use`. "Before" is the
same extractor applied to `git show HEAD:<path>` (HEAD = `3f85e7ff`).

| block | before B | after B | delta | exclusion target |
|---|---|---|---|---|
| `mk:nyquist` | 641 | 187 | -454 | `mk:testing` |
| `mk:office-hours` | 688 | 191 | -497 | `mk:plan-ceo-review` |
| `mk:orchestrate` | 911 | 228 | -683 | `mk:cook` |
| `mk:pack` | 499 | 178 | -321 | `mk:scout` |
| `mk:party` | 554 | 165 | -389 | `mk:brainstorming` |
| `mk:plan-ceo-review` | 856 | 205 | -651 | `mk:validate-plan` |
| `mk:plan-creator` | 713 | 196 | -517 | `mk:planning-engine` |
| `mk:planning-engine` | 555 | 194 | -361 | `mk:plan-creator` |
| `mk:playwright-cli` | 643 | 208 | -435 | `mk:agent-browser` |
| `mk:preview` | 612 | 206 | -406 | `mk:visual-plan` |
| `mk:problem-solving` | 623 | 201 | -422 | `mk:investigate` |
| `mk:project-context` | 353 | 206 | -147 | `mk:docs-init` |
| `mk:project-organization` | 272 | 184 | -88 | `mk:docs-init` |
| `mk:prompt-enhancer` | 709 | 190 | -519 | `mk:elicit` |
| `mk:qa` | 690 | 181 | -509 | `mk:qa-manual` |
| `mk:qa-manual` | 600 | 191 | -409 | `mk:qa` |
| `mk:react-patterns` | 432 | 200 | -232 | `mk:typescript` |
| `mk:research` | 839 | 182 | -657 | `mk:docs-finder` |
| `mk:resolving-merge-conflicts` | 779 | 162 | -617 | `mk:ship` |
| `mk:respond-pr` | 510 | 201 | -309 | `mk:review-pr` |
| `mk:retro` | 516 | 172 | -344 | `mk:memory` |
| `mk:review` | 756 | 174 | -582 | `mk:evaluate` |
| `mk:review-pr` | 515 | 181 | -334 | `mk:review` |
| `mk:rubric` | 434 | 184 | -250 | `mk:evaluate` |
| `mk:scale-routing` | 371 | 196 | -175 | `mk:agent-detector` |
| `mk:scout` | 604 | 196 | -408 | `mk:research` |
| `mk:sequential-thinking` | 530 | 201 | -329 | `mk:problem-solving` |
| `mk:session-continuation` | 342 | 177 | -165 | `mk:memory` |
| `mk:ship` | 567 | 165 | -402 | `mk:review` |
| `mk:showcase` | 713 | 192 | -521 | `mk:preview` |
| `mk:simplify` | 554 | 181 | -373 | `mk:clean-code` |
| `mk:skill-creator` | 360 | 198 | -162 | `mk:skill-template-secure` |
| `mk:skill-template-secure` | 212 | 176 | -36 | `mk:skill-creator` |
| `mk:sprint-contract` | 527 | 194 | -333 | `mk:plan-creator` |
| `mk:status` | 582 | 170 | -412 | `mk:help` |
| `mk:stitch` | 533 | 185 | -348 | `mk:figma` |
| `mk:task-queue` | 330 | 173 | -157 | `mk:team-config` |
| `mk:team-config` | 437 | 168 | -269 | `mk:worktree` |
| `mk:tech-graph` | 715 | 194 | -521 | `mk:preview` |
| `mk:testing` | 473 | 169 | -304 | `mk:nyquist` |
| `mk:trace-analyze` | 506 | 204 | -302 | `mk:retro` |
| `mk:typescript` | 384 | 193 | -191 | `mk:react-patterns` |
| `mk:ui-design-system` | 576 | 196 | -380 | `mk:frontend-design` |
| `mk:validate-plan` | 418 | 185 | -233 | `mk:plan-ceo-review` |
| `mk:verify` | 471 | 157 | -314 | `mk:lint-and-validate` |
| `mk:visual-plan` | 1160 | 196 | -964 | `mk:preview` |
| `mk:vue` | 777 | 184 | -593 | `mk:vue-best-practices` |
| `mk:vue-best-practices` | 907 | 186 | -721 | `mk:vue` |
| `mk:vue-testing-best-practices` | 1012 | 199 | -813 | `mk:testing` |
| `mk:vulnerability-scanner` | 477 | 185 | -292 | `mk:cso` |
| `mk:web-to-markdown` | 424 | 154 | -270 | `mk:docs-finder` |
| `mk:workflow-orchestrator` | 445 | 190 | -255 | `mk:cook` |
| `mk:worktree` | 675 | 206 | -469 | `mk:team-config` |
| **53 blocks** | **30782** | **9937** | **-20845** | 53 clauses, 0 unresolved |

## Budget

| figure | target | measured | verdict |
|---|---|---|---|
| per-block measured size | ≤ **280 B** | max **228 B** (`mk:orchestrate`), min **154 B** (`mk:web-to-markdown`) | PASS, **0 of 53** over |
| 53-block total | — | **9937 B**, average **187.5 B** | — |
| saving credited to this slice | — | **20845 B** (from 30782 B) | — |

Every block is also inside the contract's **290.8 B** per-non-integration-block arithmetic, at a 53-block
average of **187.5 B**, so this slice hands headroom forward rather than consuming it.

## Quality assertions (scripted over all 128 shipped skills unless stated)

- each of the 53 `description` values states the job **and** carries a `NOT for mk:<id>` clause naming its
  nearest neighbour: **53 / 53**, none omitted
- `mk:*` ids named inside the 53 blocks: **53**, each resolving to a directory under `.claude/skills/`:
  **0 unresolved**
- duplicate `description` values across all 128 shipped skills: **0**; duplicate `when_to_use` values: **0**
- empty, whitespace-only, or equal-to-`name` `description` / `when_to_use`: **0**
- `when_to_use` identical to, containing, or contained in its own `description`: **0 of 53** — each is a
  concrete trigger (what the user is doing when the skill should fire), not a restatement
- `when_to_use` carries **no** `mk:` id in any of the 53: the exclusion lives in `description` exactly once,
  so the two measured fields never duplicate routing text
- the six auto-invoked skills in this set (`mk:scale-routing`, `mk:session-continuation`,
  `mk:skill-template-secure`, `mk:task-queue`, `mk:team-config`, `mk:workflow-orchestrator`) keep an
  explicit "Not user-callable" marker in `when_to_use` — the routing fact a host needs, for ~22 B
- distinguishing verbs and nouns users actually type were kept, not dropped: file-extension triggers
  (`.vue`, `.tsx`, `.ts`), tool names (Playwright CLI, Stitch AI, Vitest, OWASP, WCAG, gh, git worktree),
  and state triggers (`git status` reporting unmerged paths, a build just finished)

## Checks run on this slice

| Check | Result |
|---|---|
| `node scripts/check-always-on-budget.cjs .` | **exit 0** — rules 25 417 (limit 25 600), always-listed **59 401** (limit 70 000) |
| `node packages/mewkit/dist/index.js validate --frontmatter` | exit 0 |
| `bash scripts/check-skill-cross-refs.sh` | exit 0 — all skill and local entrypoint refs resolve |
| `node scripts/check-kit-verbs.cjs` | exit 0 (288 refs over 24 commands) |
| `node scripts/harness-inventory.cjs --check` | exit 0 |
| only-my-files probe | **53 / 53** of my blocks changed; every other changed `SKILL.md` belongs to a parallel slice; no non-`SKILL.md` file under `.claude/skills/` was changed by this slice |

The budget figure above is measured on a tree that **also** carries the uncommitted work of the other
slices, so **59 401 B** is the combined number, not this slice alone. This slice's own contribution to the
metadata subtotals is **20845 B**.

## Not done here, deliberately

- no commit, no `--write` generator run (`docs-manifest.cjs` regeneration and the full gate run belong to
  the step that lands all slices together), and no `npm test`
- no agent `description`, no integration block, and no `.claude/rules/` file was touched
