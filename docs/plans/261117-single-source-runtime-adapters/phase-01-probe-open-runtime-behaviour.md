# Phase 1 — Probe what the docs leave open

**Priority:** high · **Status:** not started · **Effort:** 1d · **Depends on:** —

## Overview

Seven behaviours decide placement and are not documented (research/runtime-discovery-matrix.md §4). Settle each with an inspection command in a scratch project outside the repo, or record that it stays unknown and which safe placement that forces.

## Requirements

- No model turn is spent by an agent. A probe that needs one goes on a checklist the maintainer runs.
- Every result is a row in `docs/maintainer/host-probe-log.md`: host version, date, command, observed output, design it selects.
- An unknown that stays unknown selects the conservative placement: write one root only and never rely on a runtime's dedupe.

## Related files

- Modify: `docs/maintainer/host-probe-log.md`
- Create: `docs/maintainer/runtime-probe-checklist.md` (maintainer-run items)
- Read: research/runtime-discovery-matrix.md

## Steps

1. Record installed versions of Grok, Pi, OMP, Cursor Agent, Codex CLI.
2. Build a scratch project holding one skill `probe-a` in each candidate root with a different description per root, one agent per agent root, one rule per rule root, one no-op hook per hook file that appends its own path to a log.
3. Run each runtime's inspection or listing command (`grok inspect --json`, the skill and hook listing commands of the others) and read which copies are listed.
4. For OMP, read the source instead where a listing is not enough (`discovery/helpers.ts` agent tool parsing, settings merge).
5. Write the rows; move anything needing a model turn to the checklist.

## Todo

- [ ] Versions recorded
- [ ] Scratch project built outside the repo
- [ ] Rows for the seven open items
- [ ] Checklist for model-turn probes

## Success criteria

- Each of the seven items has a row with status `probed` or `unknown: conservative placement <x>`.
- No file from the scratch project is in the repo.

## Risks

- A listing command differs from what the model actually receives → mark such rows `listed, not confirmed in a turn` and keep the conservative placement.
