# Sprint 5 inventory — `MEOWKIT_*` / `MEOW_*` / `MK_*` env names, config readers, ownership surfaces

BASE = `085cb5bd2ee855431f68d0481958da9114ab92e5` (`git rev-parse HEAD` on `feat/v3-lean-runtime`, the last commit
of phase 05 — "feat: give each Python skill its own lazily created environment").

Method: every count below comes from a grep over the working tree at BASE with `node_modules`, `.git`,
`.claude/worktrees/**` (a full duplicate checkout) and `packages/mewkit/src/migrate/modules/**` (generated
codex/cursor projections) excluded. Those two exclusions matter: including them roughly doubles every number.

## 1. Name universe — 84 distinct names (round-2 correction; round 1 said 72, `plan.md` says 65)

**Round 2 correction.** Round 1 of this inventory reported 72 names from an ad-hoc grep. The universe is now
defined by one committed script, `scan-env-names.sh` in this directory, and its output at BASE is in
`universe-at-base.txt`. That is the definition AC-01 pins; any number not produced by that script is not a
claim this evidence makes.

- Trees scanned: `.claude packages scripts tests docs .github .meowkit`
- Excluded: `node_modules`, `.git`, `.claude/worktrees/**` (a full duplicate checkout),
  `packages/mewkit/src/migrate/modules/**` (generated projections), `**/dist/**`, `packages/docs/.next/**`
  (Next.js build output duplicating `packages/docs/content/`)
- Discarded: any match ending in `_` — a prefix fragment, not a name (`MEOWKIT_BUDGET_`, `MEOWKIT_SUMMARY_`,
  `MEOW_CONFLUENCE_`, `MEOW_JIRA_`)
- Out of the universe by rule: `RELEASING.md` (immutable changelog history) and `tasks/**` (workflow artefacts).
  This is why `MEOWKIT_THING`, `MEOWKIT_SECRET_BACKDOOR` and `MEOWKIT_WIKI_SLUG` — counted in round 1 — are not
  names here; they occur nowhere else. `MEOWKIT_TEST_MCP_*` lives only under `migrate/modules/__tests__/`, also
  excluded.
- In the universe by rule: `.env.example` keys (so `MEOWKIT_IMAGE_GEN_MODEL` counts) and `packages/docs/**` prose,
  because that tree ships its own `MEOWKIT_*` documentation that can go stale.

**Result at BASE: 84 names — 73 `MEOWKIT_`, 10 `MEOW_`, 1 `MK_`.** Against `plan.md` line 27's "65".

Two method findings that round 1 got wrong, both of which change rows rather than only the total:

1. **Bare `MEOWKIT_SUMMARY` is not a name.** It has zero standalone occurrences; it is the prefix of
   `MEOWKIT_SUMMARY_MODE`, and greedy `grep -o` resolves the token to the longer form.
2. **Reader detection must be composition-aware.** `.claude/skills/multimodal/scripts/env_utils.py:14` is
   `os.getenv(f'MEOWKIT_{name}') or os.getenv(name)`, with the suffixes supplied at
   `provider_router.py:28-36` (`IMAGE_PROVIDER_CHAIN`, `VIDEO_PROVIDER_CHAIN`, `SPEECH_PROVIDER_CHAIN`,
   `MUSIC_PROVIDER_CHAIN`, `IMAGE_GEN_MODEL`, `VIDEO_GEN_MODEL`, …) and at `provider_router.py:97`
   (`f'MEOWKIT_{PROVIDER_KEY_MAP[p]}'`). A literal-name grep therefore reports ~16 multimodal names as
   reader-less when they are read — `MEOWKIT_GEMINI_API_KEY[_2-4]`, `MEOWKIT_MINIMAX_API_KEY`,
   `MEOWKIT_MINIMAX_{IMAGE,MUSIC,SPEECH,VIDEO}_MODEL`, `MEOWKIT_MINIMAX_SPEECH_VOICE`,
   `MEOWKIT_OPENROUTER_{API_KEY,FALLBACK_ENABLED,IMAGE_MODEL}`, `MEOWKIT_{IMAGE,VIDEO,SPEECH,MUSIC}_PROVIDER_CHAIN`,
   `MEOWKIT_{IMAGE,VIDEO}_GEN_MODEL`. These are allowlisted (credentials, or skill-scoped options), not dropped.

Four names round 1 left in no class at all, now classified:

| Name | Where | Class |
|---|---|---|
| `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES` | **live read** at `.claude/hooks/handlers/project-context-loader.cjs:37` | toggle → `projectContext.maxBytes` |
| `MEOWKIT_HARNESS_MODE` | `packages/docs/content/docs/changelog/archive.mdx` only | drop (docs prose, no reader) |
| `MEOWKIT_MEMORY_STALENESS_MONTHS` | `packages/docs/content/docs/{cheatsheet,changelog/archive}.mdx` only | drop (docs prose, no reader) |
| `MEOWKIT_IMAGE_GEN_MODEL` | `.claude/skills/multimodal/.env.example`, `.meowkit/.env.example`; read by composition | allowlist §2e |

## 2. Classification (4 classes, not 3)

The phase-03 step 1 classification is "toggle → config key, credential → allowlist, internal/test-only → drop".
The tree needs a fourth class: **per-invocation runtime handoff**. A run id or a model hint is written by one
process and read by the next; a committed file cannot carry it, and it is not a credential.

### 2a. Toggle → config key (code reader exists, value is a user preference)

Round-2 additions to this class: `MEOWKIT_MAX_PROJECT_CONTEXT_BYTES` → `projectContext.maxBytes`
(`handlers/project-context-loader.cjs:37`). Round-2 removal: `MEOWKIT_PM_AUTO` keeps its prose consumer but gets
**no schema key**, because a declared-and-unread key is the defect this sprint removes.
Round-2 reversal: `MEOWKIT_TDD` stays a **supported env override** at top precedence (it is one of only two
sources that can turn strict mode on, so dropping the read would disable enforcement silently) in addition to
gaining the `tdd` config key.

| Env name | Read at | Proposed key |
|---|---|---|
| `MEOWKIT_TDD` | `.claude/hooks/lib/tdd-detect.cjs:36` (via `env.MEOWKIT_TDD`), `.claude/scripts/verify-env-loading.sh` | `tdd` |
| `MEOWKIT_BUDGET_CAP` | `handlers/budget-tracker.cjs:64`, `skills/autobuild/scripts/budget-tracker.sh`, `skills/benchmark/scripts/run-canary.sh` | `budget.cap` |
| `MEOWKIT_BUDGET_WARN` | `handlers/budget-tracker.cjs:62`, `skills/autobuild/scripts/budget-tracker.sh` | `budget.warn` |
| `MEOWKIT_BUDGET_BLOCK` | `handlers/budget-tracker.cjs:63`, `skills/autobuild/scripts/budget-tracker.sh` | `budget.block` |
| `MEOWKIT_BUILD_VERIFY` | `handlers/build-verify.cjs:66` | `hooks.build-verify` (on/off — collapses into the hook toggle) |
| `MEOWKIT_LOOP_DETECT` | `handlers/loop-detection.cjs:17` | `hooks.loop-detection` (on/off) |
| `MEOWKIT_PRECOMPLETION` | `handlers/pre-completion-check.cjs:93` | `hooks.pre-completion-check` (on/off) |
| `MEOWKIT_BUILD_VERIFY_TIMEOUT` | `handlers/build-verify.cjs:80` | `buildVerify.timeoutMs` (a value, so it survives as its own key) |
| `MEOWKIT_AUTOBUILD_MODE` | `handlers/build-verify.cjs:67`, `handlers/model-detector.cjs:94`, `handlers/pre-completion-check.cjs:95`, `skills/autobuild/scripts/density-select.sh`, `skills/prompt-enhancer/scripts/scout-context.py`, `core/trace-append.ts:90`, **and `lib/check-contract-signed.cjs:19,130`** | `autobuild.mode` — density only; see §5 |
| `MEOWKIT_PM_AUTO` | **no code reader**; 10 `.md` files instruct the agent on it | `pm.auto` (consumer is agent prose, which must be repointed at the key) |
| `telemetry`, `proactive`, `skip_eng_review` | `.claude/scripts/bin/workflow-config` via 11 skill preambles | §6 |

Three of the four on/off names collapse into one mechanism (`hooks.<name>: false`): `MEOWKIT_BUILD_VERIFY`,
`MEOWKIT_LOOP_DETECT` and `MEOWKIT_PRECOMPLETION` are each nothing but a switch for one handler, and
`handlers.json` already carries a `toggleKey` for every one of them.

### 2b. Credential → env allowlist (never config)

`MEOWKIT_GEMINI_API_KEY`, `MEOWKIT_GEMINI_API_KEY_2`, `MEOWKIT_MINIMAX_API_KEY`, `MEOWKIT_OPENROUTER_API_KEY`,
`MEOW_JIRA_API_TOKEN`, `MEOW_JIRA_EMAIL`, `MEOW_JIRA_SITE_URL`, `MEOW_CONFLUENCE_API_TOKEN`,
`MEOW_CONFLUENCE_EMAIL`, `MEOW_CONFLUENCE_SITE_URL`.
Readers: `skills/multimodal/scripts/{analyze_core,check_setup,document_converter,gemini_generate,video_generator,minimax_api_client,minimax_generate,openrouter_fallback}.py`,
`skills/jira/scripts/jira-as.sh`, `skills/confluence/scripts/confluence-as.sh`, plus `commands/init.ts:344,352` and
`commands/setup-steps.ts` which only *prompt* for them.

### 2c. Safety-path toggle → env allowlist (never config, by design)

Already a closed, tested set. `tests/hooks/env-allowlist.test.ts:17-37` writes out exactly what each safety
entrypoint may read and asserts both directions (nothing undeclared, nothing unread):

- `gate-enforcement.cjs`: `CLAUDE_PROJECT_DIR`, `MEOWKIT_GATE1_PRESENCE_ONLY`, `MEOWKIT_AUTOBUILD_MODE`
- `privacy-block.cjs`: `CLAUDE_PROJECT_DIR`
- `pre-ship.cjs`: `CLAUDE_PROJECT_DIR`, `MEOWKIT_HOOK_PROFILE`, `MEOW_HOOK_PROFILE`, `MEOWKIT_CLI`

The same file also asserts (`:62-69`) that **no safety path reads a dotenv file at all**. That test is the
enforcement point this sprint should extend rather than replace.

### 2d. Runtime handoff → env allowlist (per-invocation, non-credential)

`MEOWKIT_RUN_ID` (`core/trace-append.ts:87`, `skills/autobuild/scripts/budget-tracker.sh`),
`MEOWKIT_HARNESS_VERSION` (`trace-append.ts:88`), `MEOWKIT_MODEL_HINT` (`trace-append.ts:89`,
`handlers/model-detector.cjs:62`, `skills/benchmark/scripts/run-canary.sh`, `skills/autobuild/scripts/density-select.sh`),
`MEOWKIT_HOOK_PROFILE` / `MEOW_HOOK_PROFILE` (`handlers/{learning-observer:29,post-session:141,pre-task-check:67}.cjs`
plus the `pre-ship` safety path), `MEOWKIT_CLI` (`lib/memory-store-lint.cjs:41`), `MEOWKIT_HOOK_DEBUG`
(`handlers/learning-observer.cjs:47`), `MEOWKIT_COMMAND` (`.claude/scripts/injection-audit.cjs`),
`CLAUDE_*` (host).

### 2e. Skill-scoped runtime option → env allowlist

Read only by one skill's own scripts, several of them Python, so moving them into YAML would re-introduce a
`pyyaml` dependency sprint 4 just finished pinning away:
`MEOWKIT_WEB_FETCH_JS`, `MEOWKIT_WEB_FETCH_PERSIST`, `MEOWKIT_WEB_FETCH_RESPECT_ROBOTS`,
`MEOWKIT_WEB_FETCH_MAX_BYTES`, `MEOWKIT_WEB_FETCH_ROBOTS_TTL_HOURS`, `MEOWKIT_WEB_FETCH_THROTTLE_MS`
(`skills/web-to-markdown/scripts/{fetch_as_markdown,http_fetch,robots_cache,rate_limit}.py`),
`MEOWKIT_CONTEXT_WINDOW` (`skills/context-audit/scripts/estimate-tokens.sh`),
`MEOWKIT_AUDIT_OUT_DIR` (`skills/benchmark/scripts/git-index-audit.sh`),
`MEOWKIT_COST_LOG` (`skills/autobuild/scripts/budget-tracker.sh`),
`MK_SHOWCASE_PREFS_PATH` (`skills/showcase/scripts/preferences.js`),
`MEOW_CONFLUENCE_STDOUT_FILTER` (`skills/confluence/scripts/confluence-as.sh`).

### 2f. Test-only → env allowlist, test scope

`MEOWKIT_SKIP_SAFETY_SENTINEL` (`handlers/safety-sentinel-inject.cjs:46`, `handlers/post-session.cjs:124`,
`handlers/precompact-probe.cjs:30`, set only by `tests/hooks/sentinel-pipeline.test.ts:57-64`),
`MEOWKIT_WRITE_SYNOPSIS` (`cli/__tests__/synopsis-drift.test.ts:28`),
`MEOWKIT_RUN_SMOKE_TESTS` (`skills/web-to-markdown/tests/test_smoke_real_urls.py`),
`MEOWKIT_ROOT` / `MEOWKIT_API_KEY` / `MEOWKIT_VALID` / `MEOWKIT_AFTER` (`.claude/scripts/verify-env-loading.sh`,
a self-contained dotenv-parser test harness), `MEOWKIT_THING`, `MEOWKIT_SECRET_BACKDOOR`, `MEOWKIT_TEST_MCP_*`
(fixture literals).

### 2g. DROP — documented or declared, with zero reader anywhere

**Round-2 correction:** the list below is round 1's and is superseded by the `universe-at-base.txt` +
composition-aware reader column described in §1. Three names it contains are NOT in the universe
(`MEOWKIT_THING`, `MEOWKIT_SECRET_BACKDOOR`, `MEOWKIT_WIKI_SLUG` — `RELEASING.md`/`tasks/**` only); the
multimodal names it contains ARE read by composition and are allowlisted, not dropped; `MEOWKIT_PM_AUTO` keeps
its prose consumer but gets no schema key; and `MEOWKIT_HARNESS_MODE` plus `MEOWKIT_MEMORY_STALENESS_MONTHS` are
added. The authoritative drop set is whatever the committed scan plus that reader column yields, which is what
AC-01 requires the implementation to table.

Round 1's list, for the record — names with no literal `process.env` / `os.environ` / `getenv` / `${…}` read in
any `.ts`/`.cjs`/`.js`/`.sh`/`.py` outside the excluded trees:

`MEOWKIT_ACTIVE_AGENTS`, `MEOWKIT_ACTIVE_PLAN`, `MEOWKIT_BUILD_VERIFY_DEBUG`, `MEOWKIT_COMPLEXITY`,
`MEOWKIT_CONFIG`, `MEOWKIT_EVAL_SLUG`, `MEOWKIT_GEMINI_API_KEY_2`, `MEOWKIT_HARNESS_RESUME_STEP`,
`MEOWKIT_IMAGE_PROVIDER_CHAIN`, `MEOWKIT_INTERNAL_DIRS`, `MEOWKIT_INTERNAL_FILES`, `MEOWKIT_MEMORY_BUDGET`,
`MEOWKIT_MEMORY_PRUNE`, `MEOWKIT_MEMORY_PRUNE_AGE_DAYS`, `MEOWKIT_MINIMAX_SPEECH_VOICE`,
`MEOWKIT_OPENROUTER_FALLBACK_ENABLED`, `MEOWKIT_PM_AUTO`, `MEOWKIT_SECRET_BACKDOOR`,
`MEOWKIT_STORY_SIZER_COMMENT_TEMPLATE`, `MEOWKIT_SUGGESTED_PLAN`, `MEOWKIT_SUMMARY`, `MEOWKIT_SUMMARY_MODE`,
`MEOWKIT_TDD_FLAG_DETECTOR`, `MEOWKIT_THING`, `MEOWKIT_TOKEN`, `MEOWKIT_WIKI_SLUG`, `MEOW_JIRA_BASE_URL`,
`MEOW_PROFILE` (a deprecated alias announced for removal at `lib/tdd-detect.cjs:26`).

Four of these are not merely documented — they are **declared in `.claude/settings.json`'s `env` block and read
by nothing**: `MEOWKIT_TDD_FLAG_DETECTOR`, `MEOWKIT_MEMORY_BUDGET` (both literal dead keys), plus
`MEOWKIT_OPENROUTER_FALLBACK_ENABLED` and `MEOWKIT_MINIMAX_SPEECH_VOICE` which `init`/`setup` prompt for and
nothing consumes. Three more are reclassified by §2a rather than dropped: `MEOWKIT_PM_AUTO` (prose consumer),
`MEOWKIT_GEMINI_API_KEY_2` (prose-documented fallback key) and `MEOWKIT_IMAGE_PROVIDER_CHAIN`.

### 2h. `.claude/settings.json` `env` block at BASE — 9 keys

`MEOWKIT_TDD=0`, `MEOWKIT_BUILD_VERIFY=on`, `MEOWKIT_LOOP_DETECT=on`, `MEOWKIT_PRECOMPLETION=on`,
`MEOWKIT_TDD_FLAG_DETECTOR=on` (dead), `MEOWKIT_MEMORY_BUDGET=4000` (dead), `MEOWKIT_BUDGET_WARN=30`,
`MEOWKIT_BUDGET_BLOCK=100`, `CLAUDE_CODE_FORK_SUBAGENT=1` (host, keep).

## 3. Hook runtime shape at BASE (what phase 02 left)

- `.claude/settings.json` registers **13** commands, all `command: "node"`. Three are safety entrypoints
  registered directly — `gate-enforcement.cjs` (PreToolUse Edit|Write), `privacy-block.cjs` (Edit|Write, Read,
  Bash), `pre-ship.cjs` (Bash). The other registrations are `dispatch.cjs <Event> [Matcher]`.
- `gate2-check.cjs` is a **library** under `.claude/hooks/lib/`, reached from `pre-ship.cjs`; it is not its own
  registration. A config key named after it must still be rejected (it is in the phase Req 2 list).
- Observers: `.claude/hooks/handlers.json` schema 2, **22 entries in `handlers[]` over 21 distinct handlers**
  (round-2 correction: round 1 of this file said 33, which corresponds to nothing reproducible — 22 registry
  entries plus the 13 `settings.json` hook commands is 35), each
  carrying a `toggleKey`. The 21 keys are camelCase: `preTaskCheck buildVerify loopDetection budgetTracker
  autoCheckpoint learningObserver postWrite reviewEvidenceTag checkpointWriter postSession controlProbe
  preCompletionCheck modelDetector orientationRitual projectContextLoader jiraEnvLoader capabilityBootstrap
  safetySentinelInject tddFlagDetector precompactProbe posttoolfailureProbe`.
  `budgetTracker` appears twice (Edit|Write and Bash) — one key must switch off both.
  The file's own comment says: "`toggleKey` is declared here now and read from project configuration later;
  nothing switches off yet."
- **Naming mismatch.** `handlers.json` uses `learningObserver`; the phase-03 success criterion says
  `hooks.learning-observer: false`. Only one of the two spellings can be the config key.
- Toggle enforcement point: `lib/handler-registry.cjs` `selectHandlers()` (`:67`), called from
  `dispatch.cjs:62`. `validate()` (`:34`) already rejects an entry with no `toggleKey`.
- Guards are **skill-level** `hooks:` blocks in SKILL.md, all node now:
  `.claude/skills/careful/bin/check-careful.cjs`, `.claude/skills/freeze/bin/check-freeze.cjs`,
  `.claude/skills/investigate/bin/check-report-path.cjs`. The investigate guard exits 2 on a wrong report path,
  i.e. it is a hard-blocking guard with the same semantics as careful/freeze, and the phase Req 2 list omits it.
- `tests/hooks/golden/` holds **82** fixtures (83 files including `index.json`, whose own `fixtureCount` is 82),
  grouped `gate1` 13, `gate2-preship` 12, `privacy` 5, `stdin-unreadable` 6, `post-write` 2,
  `pre-completion-check` 2, `guard-careful` 2, `guard-freeze` 3, `guard-investigate` 3, three gate-helper groups
  (3+4+3), seven observer groups (3+3+2+2+3+1+1+1) and `cli-pre-implement` 5, `cli-append-trace` 3.
- Hooks require **only** `node:` builtins and sibling `.cjs` files — zero npm dependencies (verified by grepping
  every `require(…)` under `.claude/hooks`). `packages/mewkit` does depend on `js-yaml@^4.1.0` and `zod@^3.23.8`.
  So a hook cannot `require('yaml')`: any YAML a hook reads needs a vendored, dependency-free reader.
- The only CLI resolution on a safety path is `lib/memory-store-lint.cjs:41` (`MEOWKIT_CLI` → project-local
  `node_modules/.bin/mewkit` → bare `mewkit`), and a missing CLI degrades to
  `SKIP: mewkit CLI not found — team memory store not linted` (`:48`). No observer spawns `mewkit` at all.
  So "safety hooks need no CLI" already holds, with that one documented soft-skip.

## 4. Gate-weakening env reads (the reason `autobuild.mode` is not a simple key)

`.claude/hooks/lib/check-contract-signed.cjs:19` — `const BYPASS_MODES = ['LEAN', 'MINIMAL'];` — and `:130`
`const mode = env.MEOWKIT_AUTOBUILD_MODE || '';`. A matching value **skips the sprint-contract gate** and appends
a line to the bypass log (`:94`). `gate-enforcement.cjs:135` calls `checkContractSigned`.
`gate-enforcement.cjs:126` is the other one: `env.MEOWKIT_GATE1_PRESENCE_ONLY === '1'` downgrades the approval
check to presence-only and announces it on stderr (`:129`).

Consequence: `autobuild.mode` and any gate hatch are the two keys for which "a committed file is changeable by
anyone with a PR" (phase Key Insight 3) is not theoretical.

## 5. Ownership / update / uninstall surfaces that already exist

- `core/install-metadata.ts` — `InstallMetadataSchema` with `files[]`, each entry carrying
  `path / owner ("meowkit"|"user"|"meowkit-modified") / layer ("core"|"skill"|"user") / checksum / baseChecksum`
  (`:15-26`). Canonical file `.meowkit/metadata.json`; `state/resolve-metadata-path.ts` falls back to
  `.claude/metadata.json` and explains why forking the baseline would silently overwrite user edits.
- **Paths in that metadata are relative to `.claude/` only.** `core/compute-checksums.ts` `classifyLayer`
  (`:52`) keys off `.claude/`-relative top-level dirs; `CORE_DIRS` = `agents commands hooks modes rules scripts`,
  `USER_DIRS` = `memory logs`, `USER_FILES` includes `meowkit.config.json`, `.env`, `mcp.json.example`,
  `gitignore.meowkit`. Nothing under `.meowkit/` is tracked for ownership today.
- `core/find-orphans.ts` — `DEFAULT_ORPHAN_SCOPES` = `rules rules-conditional skills agents hooks scripts`,
  with an explicit comment that user-private state (`memory/`, `logs/`, `.env`, `secrets/`) is never inspected.
- `core/smart-update.ts` (621 lines) is the write path; `commands/upgrade.ts:290` calls it with
  `dryRun = false, force = false` hardcoded. `upgrade` prints "use `--yes` to confirm" for orphans (`:319`) and
  "use `--force` to overwrite" for user-modified files (`:327`).
- **No snapshot/backup module exists.** The only backup anywhere is `core/merge-settings.ts:72-84`, a single
  `settings.json + ".bak"` copy restored on merge failure.
- `--dry-run` is declared for `init`, `plan`, `migrate` only; `--force` for `init`, `visual-plan`, `migrate`;
  `--yes` for `upgrade`, `pack`, `migrate`; `--json` for 16 read-mostly commands and **no** mutating one
  (`cli/command-catalogue.ts:83-123`). `upgrade` has no `--dry-run` at BASE.
- `release-manifest.json` (per-file checksums, `core/release-metadata.ts:10-26`) is generated by
  `scripts/prepare-release-assets.cjs:33` and shipped **in the release zip**, next to `.claude/` and
  `.meowkit/pack-manifest.json` (`:56-57,65`). It is not copied into the installed project, so an offline
  `doctor --adopt` has no authentic baseline unless install starts writing it.
- `commands/doctor.ts:58` still probes for the legacy `.claude/meowkit.manifest.json`, which does not exist in
  this tree. `.claude/metadata.json` here is the 233-byte legacy version-only form (`version: 2.10.3`).

## 6. The existing config files, and what actually reads them

- `.meowkit/config.json` at BASE is an **install descriptor, not a preference file**: `version`, `name`,
  `description`, `buildDate`, `repository`, and a `features` object (`memory`, `costTracking`, `tdd`, `harness`,
  `conversationSummary`) that **nothing reads**. Readers of the path: `index.ts:53` (`mewkit status` prints every
  key), `core/smart-update.ts:240` (copies it in), `core/validate-install.ts:57` (asserts it exists),
  `commands/doctor.ts:57` and `commands/doctor-checks.ts:253`, `commands/validate.ts:263`.
- `state/resolve-config-path.ts` resolves canonical `.meowkit/config.json` → legacy
  `.claude/meowkit.config.json`.
- `.claude/scripts/bin/workflow-config` (node, sprint 4 D2) is a dot-notation `get`/`set`/`has` over that same
  file. The keys actually used by its 11 callers are only three: `get proactive` (9×), `get telemetry` (9×),
  `set telemetry off|community|anonymous` (32×), `set skip_eng_review true` (2×). Callers:
  `skills/{cso,investigate,document-release,qa,review,plan-ceo-review,office-hours,retro}/references/preamble.md`,
  `skills/plan-ceo-review/references/post-review.md`, `skills/ship/references/{preamble,pre-flight}.md`.
  `set` mutates the file at runtime — i.e. the config is **agent-written today**.
- `.meowkit/gitignore.meowkit` at BASE is an **append template for the project root `.gitignore`**, with
  per-class ignores (`.meowkit/telemetry/`, `.meowkit/state/`, `.meowkit/cache/`, `.meowkit/envs/`) plus
  non-`.meowkit` entries (`.env`, `.env.local`, `session-state/`, `tasks/reports/`, `.claude/logs/`). Its own
  comment says config and memory "are meant to be committed, so the ignores are per-class rather than the whole
  dir" — the opposite shape from the phase Req 8 deny-all-plus-allowlist `.meowkit/.gitignore`.
  `commands/setup-steps.ts:131-158` appends it and carries a one-off `stripStaleMemoryIgnore` migration.
- `.meowkit/` at BASE contains: `.env.example`, `config.json`, `envs/`, `gitignore.meowkit`,
  `harness-inventory.json`, `mcp.json.example`, `memory/`, `pack-manifest.json`, `state/`, `telemetry/`.
  There is **no `bin/`** — the committed launcher is phase 06.
- `mewkit` verbs at BASE (`cli/command-catalogue.ts:6-66`): `init upgrade validate capabilities budget setup
  skill doctor status task-state advice orient context task migrate providers explain-support visual-plan review
  inventory plan trace pack verdict-gate note docs-manifest`. No `uninstall`, no `backups`, no `audit`.
  `index.ts:456` rejects an unknown command; unknown **flags** are ignored (minimist).

## 7. Open facts the contract turns into decisions

Round-2 note: items 10 and 11 below are resolved differently than round 1 proposed. `release-manifest.json` is
**not** committed (`plan.md` Decision 3, user-confirmed 261101), and the ownership baseline is made *insufficient
on its own*: a file is deletable only when the baseline says it is kit-owned AND its content agrees with a trusted
kit source — rather than by committing a manifest that carries no signature or digest field
(`core/release-metadata.ts:20-25`).

**Round-2b correction to that source.** Round 2 named the trusted source as "the kit content carried by the
running `mewkit` installation". It carries none, and this is architectural rather than a bug:

- `packages/mewkit/package.json` publishes `files: ["dist", "portable-manifest.json", "NOTICE"]` — no kit content.
- `core/github-releases.ts:87-88` `downloadRelease` fetches the release asset into
  `join(tmpdir(), "meowkit-release-${version}-${Date.now()}")`, and `commands/upgrade.ts:334` calls
  `cleanupDownload(sourceDir)` → `rmSync(tempDir, {recursive, force})` (`github-releases.ts:127-133`). Timestamped
  temp dir, deleted after use; no persistent local kit cache exists anywhere in `core/` or `state/`.
- `plan.md` **Decision 4, user-confirmed 261101**: "Kit artifact on GitHub release only; npm `mewkit` ships the
  CLI only; CLI and kit version independently."

**USER DECISION (261108), verbatim choice "Local kit cache (Recommended)":** `init` and `upgrade` keep a copy of
the kit they installed under `.meowkit/cache/`, never committed (D11's deny-all keeps it untracked), and that copy
is the trusted source `uninstall` and `doctor --adopt` check against. The trust clause narrows from "no in-project
file is trusted" to "no **tracked** in-project file is trusted" — the relied-on property is that a pull request
cannot introduce or alter an untracked file. Neither Decision 3 nor Decision 4 is disturbed: the cache is not
committed and the artifact is still released on GitHub only. See contract D11, D12, AC-08, AC-09, AC-10, AC-11.

1. `handlers.json` toggle keys are camelCase; the phase success criterion is kebab-case.
2. `MEOWKIT_AUTOBUILD_MODE` is simultaneously a density preference and a contract-gate bypass.
3. The investigate guard blocks like careful/freeze but is absent from the phase Req 2 protected list.
4. `gate2-check` is a library, not a registration, yet must be a rejected key name.
5. Hooks cannot parse YAML with a library; the CLI can. Two readers, one grammar.
6. `.meowkit/config.json` is an install descriptor whose `features` block is dead; "one project config" has to
   rule on it.
7. `workflow-config set` writes the config at runtime; a committed config must not be agent-written.
8. Ownership metadata covers `.claude/` only, so uninstall has no baseline for `.meowkit/`.
9. No snapshot module exists, and `upgrade` has no `--dry-run`.
10. `release-manifest.json` is not installed, so `doctor --adopt` is not offline-capable without a change.
11. The phase Req 8 allowlist re-includes `bin/mewkit`, which phase 06 creates.
12. 28 names, including two declared in `settings.json`, have no reader at all.
