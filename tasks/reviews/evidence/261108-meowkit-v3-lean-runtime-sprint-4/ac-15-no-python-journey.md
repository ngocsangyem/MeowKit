# No-Python journey

Recorded 2026-11-07T23:37Z by the orchestrator. Raw stream-json transcripts are kept outside the repo: they embed the
operator's global plugins and system context, which do not belong in a committed artifact. Excerpts below are verbatim.

## Environment capture

```
== environment capture ==
Sat Nov  7 23:37:52 UTC 2026
PATH=/var/folders/jn/s2swddy568g_d3h2ywk0sl240000gn/T/no-python-bin-aVpj29
command -v python3: (none)
command -v python: (none)
node: v26.13.0
claude: 2.1.316 (Claude Code)
kit source: working tree of feat/v3-lean-runtime (uncommitted, on top of 41af645a)
```

The PATH is `scripts/lib/no-python-path.cjs`'s sandbox: every executable on the real PATH except python, python2,
python3, python3.x, py and pypy. `leakedInterpreters` returned `[]`.

**Project.** `mewkit init` fetches the published release, which does not contain this change, so the fixture project was
laid down the way `init` lays it down: the working-tree `.claude/`, `CLAUDE.md` and `.meowkit/gitignore.meowkit` copied
into a fresh git repository with one source file (`sum.js`) and a script-less `package.json`. The hooks resolved the
CLI through `MEOWKIT_CLI` set to this checkout's build.

## Session start

Six SessionStart hook outputs. The kit's own block opens with `Model: not detected (defaulting to STANDARD/FULL)` and
carries no Python or venv warning. The one Python line in the session came from the operator's global `watch` plugin
(`~/.claude/plugins/.../watch/hooks/scripts/check-setup.sh`), not from the kit:

```
/watch: Python 3.10+ is needed. Install a working Python interpreter and invoke the watch skill.
```

## /mk:cook to Gate 1

Prompt: `/mk:cook Add a subtract(a, b) function to sum.js next to add, exported the same way.` The cook skill loaded,
the agent tried to edit `sum.js` and Gate 1 refused it on its own terms:

```
PreToolUse:Edit hook error: [node ${CLAUDE_PROJECT_DIR}/.claude/hooks/gate-enforcement.cjs]: @@GATE_BLOCK@@
No approved plan found in tasks/plans/.
Gate 1 requires an approved plan before source code changes.
Create a plan first: /mk:plan-creator or /mk:fix for simple fixes.
```

The agent wrote `tasks/plans/261108-add-subtract-function/plan.md` and ended the run asking for Gate 1 approval
(`subtype: success`, `stop_reason: end_turn`). `sum.js` was never changed. No approval was given.

## Plan structural check

```
$ node <checkout>/packages/mewkit/dist/index.js plan check --structural tasks/plans/261108-add-subtract-function
PLAN_INCOMPLETE: 3 error(s), 0 warning(s)
  - plan.md: Missing frontmatter: type
  - plan.md: Missing frontmatter: priority
  - plan.md: Missing section: ## Goal
```

The check ran with no interpreter and judged the hand-written plan on its own terms. The first attempt to run it on the
plan directory found a defect: `plan check --structural <dir>` failed with `EISDIR` (the deleted Python validator took a
`plan.md` path too). `check-plan-structure.ts` now resolves a directory to its `plan.md`, with a test in
`core/__tests__/check-plan-structure.test.ts`. The excerpt above is the rerun after that fix.

## One Python skill invoked

The documented `llms` invocation from its SKILL.md:

```
$ node .claude/scripts/skill-python.cjs .claude/skills/llms/scripts/generate-llms-txt.py --help
[llms] no interpreter environment

No Python interpreter is installed, and llms requires python>=3.9.
Install it, then run:

    mewkit skill env llms

This command installs only the packages llms pins. It is never run for you.
```

Exit 1, no traceback, the remediation message described for the no-Python state.

## Scan

Across all three session transcripts, `traceback` matches 0 times and `venv` matches only inside the agent's own grep
pattern (`grep -nE "python|\.py|venv" .claude/skills/figma/SKILL.md`). No kit error names Python or a venv. Every run
completed with `subtype: success`.
