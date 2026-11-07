# Python / venv inventory — sprint 4 (phase 05 lazy per-skill Python)

Scouted 261108 on `feat/v3-lean-runtime` working tree (phase 02 node-only hooks applied, uncommitted).
Excluded from every count: `.claude/skills/.venv/`, `.claude/worktrees/`.
Classification: **hook** (runs on a Claude Code hook event) · **CI** (a step in `.github/workflows/ci.yml`) ·
**skill** (invoked by a SKILL.md / step file / skill script) · **repo-dev** (repo tooling or local test harness,
never shipped into a user project) · **manual** (documented, operator-run).

## 1. Headline numbers

| Measure | Value |
|---|---|
| `.py` files under `.claude/` | 61 |
| `.py` called by a **hook** | **0** |
| `.py` run by a **CI** step directly | 5 (+4 more via bash CI steps) |
| `.py` in the **core workflow** path (plan → cook → review → ship) | 2 (`plan-creator/scripts/validate-plan.py`, `evaluate/scripts/recompute-score.py`) |
| `.sh`/`.py` left under hook paths | 1 — `.claude/hooks/ensure-skills-venv.sh` |
| SessionStart registrations in `.claude/settings.json` | 2 (`ensure-skills-venv.sh` at `:26`, `dispatch.cjs`) |
| Files referencing `.claude/skills/.venv` (excl. worktrees, excl. the venv itself) | 136 (99 of them regenerated codex/cursor projections under `packages/mewkit/src/migrate/modules/`) |
| Skill-local `requirements.txt` | 4 — `multimodal`, `web-to-markdown`, `jira`, `confluence` |

## 2. The one remaining shell hook

- `.claude/hooks/ensure-skills-venv.sh:5` — `VENV="${CLAUDE_PROJECT_DIR:-$PWD}/.claude/skills/.venv"`; creates the
  shared venv on every SessionStart, fails open with a stderr line when `python3` is absent (`:11`).
- Registered: `.claude/settings.json:26` → `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/ensure-skills-venv.sh"`, timeout 30,
  statusMessage "Ensuring Python skills venv...".
- Named elsewhere: `.claude/hooks/HOOKS_INDEX.md:10`, `:42`; `packages/mewkit/src/commands/doctor-hook-runtime.ts:17`
  (`SWEEP_EXCLUDE = ["ensure-skills-venv.sh"]` — the sweep that otherwise reports leftover `.sh` hooks).
- Second always-on Python nag, hook-path but not `.sh`:
  `.claude/hooks/handlers/project-context-loader.cjs:119-126` injects a `## WARNING: Python venv not found` block into
  SessionStart context whenever `.claude/skills/.venv/bin/python3` is missing, and tells the user to run `mewkit setup`.

## 3. `.py` by caller

### 3a. Hook-called: none

Grep of `.claude/hooks/**` for `python`/`.py`/`venv` (`--include=*.cjs,*.json,*.md`) returns only:
`pre-implement.cjs:77` (reads `pyproject.toml`/`setup.py`/`pytest.ini` as *markers*, never runs Python),
`privacy-block.cjs:49` (regex naming `fetch_as_markdown.py` as a web-fetch command — string only),
`lib/preship-checks.cjs:94-111` (`pythonChecks` runs `pytest`/`ruff` **only if installed**, via `runIfInstalled`),
`lib/session-context-report.cjs:19` (probes `python3` for the capability report),
`handlers/build-verify.cjs:39` (`.venv` path exclusion). **No hook executes a `.py` file.** Phase 02's port already
removed the last `python3 -c` JSON parses (`lib/read-hook-input.sh`, `gate2-check.sh:161`, `append-trace.sh:74`,
`post-session.sh:280`, `pre-completion-check.sh:44`, `tdd-flag-detector.sh:54` — all deleted, evidence in
`git status` for `.claude/hooks/`).

### 3b. CI-called (`.github/workflows/ci.yml`)

| Line | Step | Script | Interpreter |
|---|---|---|---|
| 100-103 | Setup Python venv | — | `python3 -m venv .claude/skills/.venv`; `pip install pyyaml jsonschema pytest` |
| 106 | Multimodal mock tests | `.claude/skills/multimodal/scripts/tests/run_tests.py` | venv |
| 109 | Validate Figma evidence packet fixtures | `.claude/skills/figma/evals/validate-evidence-packets.py` | venv |
| 113-116 | web-to-markdown SSRF guard | `pytest` on `web-to-markdown/tests/test_safe_url.py`, `test_e2e_offline.py` (+ `pip install -r .../web-to-markdown/scripts/requirements.txt`) | venv |
| 128 | Routing eval | `.claude/skills/scale-routing/eval/run-routing-eval.py` (imports `eval/classify.py`) | venv |
| 134 | Journey specs frozen + valid | `tests/journey-validation/check-journey-specs.py` (**outside `.claude/`**) | venv |
| 202 | Validate skill frontmatter | `scripts/validate-skill-frontmatter.py` (**outside `.claude/`**, needs pyyaml + jsonschema, reads `.claude/schemas/skill-schema.json`) | venv |
| 205 | Validate docs references | `.claude/scripts/check-docs-references.py .claude` | **system `python3`** |
| 208 | Unit-test docs-references validator | `.claude/scripts/tests/test-check-docs-references.py` | **system `python3`** |
| 211 | Unit-test skill-frontmatter validator | `.claude/scripts/tests/test-validate-skill-frontmatter.py` | venv |
| 118-126 | plan-creator / skill-creator / story-sizer fixture suites | bash wrappers that shell out to `.py` (below) | venv w/ `python3` fallback |
| 226 | Lint brand prose (diff mode) | `.claude/scripts/lint-brand-prose.sh` → `.claude/scripts/check-anthropic-context.py` (`lint-brand-prose.sh:39-40` hard-exits when `python3` is absent; `:71`, `:123`, `:135`) | system `python3` |

Bash CI steps with a `.py` dependency:
`tests/fixtures/plan-creator/validate-fixtures.sh:22` → `plan-creator/scripts/validate-plan.py`;
`tests/fixtures/skill-creator/validate-fixtures.sh:9` → `skill-creator/scripts/validate-skill.py`;
`tests/story-sizer-all.test.sh` → `story-sizer-{heuristics,input-adapter,auto-create-gating,auto-create-execution}.test.sh:6-8`
(each `PY=.claude/skills/.venv/bin/python3`, `[ -x "$PY" ] || PY="python3"`);
`scripts/check-hook-registration.sh:44-45` (`python3` JSON parse of `settings.json`, repo-dev + CI step at `ci.yml:139`).

**Already duplicated in TypeScript:** `check-docs-references.py` has a line-for-line TS port at
`packages/mewkit/src/core/check-docs-references.ts:107` ("Kept identical to `.claude/scripts/check-docs-references.py`
(parity)"), wired into `mewkit validate` at `packages/mewkit/src/commands/validate.ts:227`. The two CI steps at
`ci.yml:205` and `:208` are therefore redundant with an existing node check.

### 3c. Skill-called (keep Python, gets a per-skill env)

| Skill | `.py` | Called from |
|---|---|---|
| `multimodal` | 18 (incl. `scripts/tests/*`) | `SKILL.md`, `workflows/*`, `references/*` (9 files hard-code the venv python path) |
| `web-to-markdown` | 13 | `SKILL.md`, agents `analyst.md:90`, `researcher.md:116`, `planner.md:167`, `investigate/SKILL.md:144`, `intake/SKILL.md:204` |
| `story-sizer` | 5 | `SKILL.md`, `references/orchestration.md`, `references/report-writer.md` |
| `tech-graph` | 2 | `SKILL.md`, `references/svg-authoring-and-recovery.md`, `scripts/test-all-styles.sh` |
| `planning-engine` | 2 (`capacity-bin.py`, `dep-graph.py`) | `SKILL.md`, `references/planning-guide.md`, `agents/planning-reporter.md` |
| `skill-creator` | 2 (`init-skill.py`, `validate-skill.py`) | `SKILL.md` |
| `scale-routing` | 2 (`eval/classify.py`, `eval/run-routing-eval.py`) | CI (3b) |
| `llms` | 1 | `llms/SKILL.md` (venv path, 2 refs) |
| `confluence` | 1 (`adf_to_md.py`) | `SKILL.md`, `scripts/adf-to-md.sh` |
| `figma` | 1 (`evals/validate-evidence-packets.py`) | CI (3b) |
| `prompt-enhancer` | 1 (`scout-context.py`) | `references/deep-mode-scout.md`, `eval/canary-09-deep-boundary.md` |
| `evaluate` | 1 (`recompute-score.py`) | `evaluate/scripts/validate-verdict.sh` — **autobuild verdict path** |
| `plan-creator` | 1 (`validate-plan.py`) | **core workflow**: `step-04-semantic-checks.md:45` (mandatory unless `planning_mode=fast|product-level`), `SKILL.md:232`, `workflow.md`, 5 more reference files, `validate-plan/SKILL.md:121` |

### 3d. `.claude/scripts/*.py` (10 files) — none hook-called

| File | LOC | Caller class | Evidence |
|---|---|---|---|
| `injection-audit.py` | 228 | **safety/audit** + skill library | `rules/injection-rules.md:56` (Rule 10 LOG), `rules/gate-rules.md:95`, `agents/security.md:45`, `skills/vulnerability-scanner/SKILL.md:67`; **imported as a Python module** by `web-to-markdown/scripts/persist_fetch.py:173-185` (`importlib`, `scan_file`) and probed by `story-sizer/scripts/check-auto-create-gating.py:146` |
| `check-docs-references.py` | 194 | CI | `ci.yml:205`; TS port already exists (3b) |
| `tests/test-check-docs-references.py` | — | CI | `ci.yml:208` |
| `tests/test-validate-skill-frontmatter.py` | — | CI | `ci.yml:211` |
| `check-anthropic-context.py` | 175 | CI (via bash) + repo-dev | `lint-brand-prose.sh:26`, `tests/changed-files-lint.test.sh:19` |
| `validate.py` | 281 | skill/manual | `commands/mk/validate.md:16`, `skills/testing/references/validation-scripts.md:42`, `vulnerability-scanner/SKILL.md` |
| `security-scan.py` | 133 | skill/manual (imports `validate.py:13`) | `commands/mk/validate.md:17`, `vulnerability-scanner/SKILL.md:66` |
| `checklist.py` | 173 | **no live caller** — only `doctor-checks.ts:140` asserts its presence | — |
| `cost-report.py` | 178 | manual | `docs/operations/docs-references-inventory.md:58` |
| `validate-docs.py` | 210 | **no caller found** | — |

`packages/mewkit/src/commands/doctor-checks.ts:140` hard-codes
`expected = ["validate.py", "security-scan.py", "checklist.py", "injection-audit.py"]` and WARNs when any is missing →
porting or deleting any of the four changes `mewkit doctor` output. `doctor-checks.ts:30` (`checkPython`) probes
`python3 --version` / `python --version` and is reported by `doctor.ts:91` as a `Python 3.9+` row.

## 4. `.claude/scripts/bin/workflow-config`

- Bash + two `python3 -c` heredocs: `workflow-config:16` (read, `resolve_key`) and `:60` (write, `set`).
- Config file: `CONFIG_FILE="${WORKFLOW_CONFIG:-.claude/meowkit.config.json}"` (`:9`). **That file does not exist in this
  repo**, and the TS side treats it as legacy: `packages/mewkit/src/state/resolve-config-path.ts:13`
  (`LEGACY_CONFIG_REL = .claude/meowkit.config.json`) with canonical `.meowkit/config.json` (`:15`). Phase 03 targets
  `.meowkit/config.yaml`. Three config paths in play.
- **Exact duplicate** at `.claude/scripts/bin/meowkit-config` (diff = names + `MEOWKIT_CONFIG` env var only). No file
  outside `.claude/scripts/bin/` references `meowkit-config`.
- Callers — **9 skills**, all in skill preambles (`get proactive`, `get telemetry`, `set telemetry`,
  `set skip_eng_review`): `cso/references/preamble.md:8,17,49,55,66,67`;
  `review/references/preamble.md:25,34,66,72,83,84`; `qa/references/preamble.md:24,33,65,71,82,83`;
  `document-release/references/preamble.md:8,17,...`; `investigate/references/preamble.md:11,20`;
  `plan-ceo-review/references/preamble.md:8,17` + `post-review.md:79`; `office-hours/references/preamble.md:16,25`;
  `retro/references/preamble.md:8`; and **`ship/references/preamble.md:23,32,69,80,81`** (`get proactive`,
  `get telemetry`, three `set telemetry` — the ship-path caller, added 261108 after evaluator round 1 found it missing
  from this list and therefore from AC-08's oracle).
  Every call is `... 2>/dev/null || echo "true"` / `|| true` — i.e. today they all silently take the default, because
  the config file is absent. No `mewkit config` verb exists (`packages/mewkit/src/index.ts` case list: `init`,
  `upgrade`, `validate`, `review`, `capabilities`, `pack`, `providers`, `explain-support`, `plan`, `inventory`,
  `trace`, `orient`, `budget`, `docs-manifest`, `verdict-gate`, `note`, `setup`, `doctor`, `status`, `task-state`,
  `advice`, `context`, `task`, `visual-plan`, `migrate` — no `config`, no `skill`).
- Sibling bash in the same dir (not Python): `setup-workflow` (`exec npx mewkit setup`), `meowkit-slug`/`workflow-slug`,
  `meowkit-diff-scope`/`workflow-diff-scope`, `meowkit-repo-mode`/`workflow-repo-mode`, `workflow-review-log`.

## 5. `.claude/skills/.venv` references outside the skills themselves

| Area | Files | Notes |
|---|---|---|
| `packages/mewkit/src/migrate/modules/{codex,cursor}/...` | 99 | regenerated projections — follow automatically once sources change |
| `packages/mewkit/src/core/dependency-installer.ts` | `:21` `VENV_RELATIVE = .claude/skills/.venv`; `:24-28` `validateInsideClaude` path guard; `:57` pip path; `:65` python path; `:73-83` `ensureVenv`; `:126` "Run 'mewkit setup --only=venv' first" |
| `packages/mewkit/src/commands/setup-steps.ts` | `:64-71` `setupVenv`; `:169` `venvDir = .claude/skills/.venv` in `setupDeps`; `:229` `STEPS.venv` |
| `packages/mewkit/src/core/skills-dependencies.ts` | `:33-41` discovers `.claude/skills/{skill}/scripts/requirements.txt`, merges them into ONE install set; `:13` `DEFAULT_PIP_PACKAGES` fallback |
| `packages/mewkit/src/lib/system-deps-registry.ts` | `:87-111` venv python/playwright probes; `:173-189` `playwright-chromium` detect + install commands (3 platform variants) hard-code the venv |
| `.claude/hooks/` | 2 (`ensure-skills-venv.sh:5`, `handlers/project-context-loader.cjs:119-123`) |
| `.claude/agents/` | 4 (`analyst.md:90`, `researcher.md:116`, `planner.md:167`, `jira-analyst.md:77`) |
| `.claude/skills/trace-analyze/` | 6 (`SKILL.md:65`, `step-01..04`, `references/trace-schema.md:77`) — Python used **only as a jq replacement** for JSON parsing |
| `.claude/skills/benchmark/scripts/` | 3 (`run-canary.sh:25,68`, `compare-runs.sh:39`, `git-index-audit.sh:81`) |
| `.claude/skills/jira` / `confluence` | 5 / 4 — venv is the **install target of CLI binaries**: `jira/scripts/jira-as.sh:9` resolves `$ROOT/.claude/skills/.venv/bin/jira-as`; `commands/mk/confluence-setup.md:11` expects `.venv/bin/confluence-as` |
| `tests/` | 7 (`git-index-audit.test.sh:15`, 4 story-sizer suites, 2 fixture validators) |
| `scripts/` | 4 (`check-hook-registration.sh:44`, `validate-skill-frontmatter.py`, `telemetry-decisions.py`, `prepare-release-assets.cjs` exclusion glob) |
| `docs/core/` | 2 | `.github/workflows/ci.yml` | 1 (`:100-103` + the venv-prefixed steps) |
| `.gitignore` | `:41` `.claude/skills/.venv/`; `.meowkit/gitignore.meowkit` last line, same entry. **No `.meowkit/envs/` ignore yet** (`.gitignore:50-56` ignores only `telemetry/`, `state/`, `cache/`) |

## 6. `.claude/schemas/skill-schema.json`

- `required: ["name", "description"]`, `additionalProperties: **true**` → an unknown key is accepted today, so
  `requires_runtime` needs an explicit property + a validator rule to be enforceable.
- 27 declared properties. **A `runtime` property already exists** and means something else:
  `{"type":"string","enum":["claude-code","portable","experimental"],"description":"Optional (governance). Execution
  environment required by this artifact."}` — set to `runtime: claude-code` on all 125 SKILL.md files, including
  `multimodal/SKILL.md:43` and `web-to-markdown/SKILL.md:16`.
- Schema consumers: `scripts/validate-skill-frontmatter.py` (CI, Python, needs `pyyaml` + `jsonschema`),
  `.claude/scripts/tests/test-validate-skill-frontmatter.py` (CI, Python),
  `.claude/skills/skill-creator/references/skill-authoring-rules.md`.

## 7. `injection-audit.py` call shape (for the node port)

`main()` at `:177`: `argv[1]` = directory (default cwd), optional `--output FILE` (`:7`). Public functions
`scan_content:74`, `scan_file:119`, `check_file_outside_project:128`, `scan_directory:141`, `write_security_log:161`.
Writes `"{directory}/.meowkit/telemetry/security-log.md"` (`:212`). Prints `CRITICAL:`/`SUSPICIOUS:` counts,
`HALT: ...` on critical (`:204`), `CLEAN — no injection indicators found.` on empty (`:223`).
`scan_directory` skips `.claude/*` subdirectories — which is why `web-to-markdown` imports `scan_file` directly
(`references/security.md:278`).

## 8. Pre-existing python-free behavior worth keeping

- `.claude/hooks/lib/preship-checks.cjs:94-111` — pytest/ruff/flake8 run through `runIfInstalled`, so pre-ship already
  degrades cleanly without Python.
- `tests/hooks/golden/` holds 83 fixtures (phase 02); none invokes a `.py` file.
- `.claude/scripts/bin/setup-workflow` is already a thin `exec npx mewkit setup` wrapper.
