# `mewkit-next` runtime smoke checklist

CI proves what `mewkit-next` writes (`lifecycle_matrix`, the emitter goldens). It cannot prove
that a real runtime **reads** it: that needs an authenticated Claude Code, Codex CLI and
Cursor, which an agent must not drive. A maintainer runs this list on a real machine for every
binary beta, and before the [cutover](mewkit-next-cutover.md). A failed item reopens the code
that emits that runtime's files; it is not waived.

The list covers a **project** install. A global install carries less: global Cursor registers
only the privacy and session-context hooks, so the plan gate (item 8) does not apply there.

## Setup (once per run)

1. Install the binary under test: `curl -fsSL https://raw.githubusercontent.com/ngocsangyem/MeowKit/main/install.sh | MEWKIT_CHANNEL=beta sh`
   (Windows: `install.ps1`). Record `mewkit-next --version`.
2. Make a throwaway git project with one source file, e.g. `src/app.js`.
3. In it: `mewkit-next init --target all`, then `mewkit-next doctor`. Every runtime's install
   and hooks rows must read `ok`. For Codex, trust the project in Codex first; doctor warns
   until then.

## Items

What each runtime is expected to carry is `.claude/hooks/hook-coverage.json` in the kit;
the rows below follow it.

Run each in a fresh session of that runtime, opened in the project.

| # | Runtime | Do | Pass when |
| ---: | --- | --- | --- |
| 1 | Claude Code | Start a session | The session-start context (MeowKit orientation) is visible in the first turn |
| 2 | Claude Code | Ask it to change `src/app.js` with no approved plan | The edit is blocked, and the message names the missing approved plan |
| 3 | Claude Code | Run a skill that runs a bundled script (e.g. `mk:docs-finder`) | The script runs from the skill's own directory without a "not found" |
| 4 | Codex CLI | Start a session (approve the hooks when `/hooks` asks); ask which workflow rules apply here | It answers from the MeowKit block in `AGENTS.md` (gates, plan first). Codex gets no session-start hook; `AGENTS.md` carries its standing context |
| 5 | Codex CLI | Ask it to change `src/app.js` with no approved plan | Blocked, with the reason |
| 6 | Codex CLI | Run a skill with a bundled script | The script runs |
| 7 | Cursor | Open the project, start an agent chat | The `sessionStart` hook's short pointer to `.meowkit/` state is in context (not the full Claude Code orientation) |
| 8 | Cursor | Ask it to change `src/app.js` with no approved plan | Blocked, with the reason |
| 9 | Cursor | Run a skill with a bundled script | The script runs |

Then `mewkit-next uninstall --target all --yes`; `git status` must show only what you added,
plus `.meowkit/` (mewkit's state and backups stay; they are never deleted).

## Record

Copy this table into the binary release's notes or the PR that prepares the cutover.

| # | Result (pass/fail) | Runtime version | Notes |
| ---: | --- | --- | --- |
| 1 | PENDING | | |
| 2 | PENDING | | |
| 3 | PENDING | | |
| 4 | PENDING | | |
| 5 | PENDING | | |
| 6 | PENDING | | |
| 7 | PENDING | | |
| 8 | PENDING | | |
| 9 | PENDING | | |

Binary: `mewkit-next` ______ · Kit: ______ · OS: ______ · Date: ______ · By: ______
