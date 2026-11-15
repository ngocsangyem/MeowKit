# MeowKit evolution research — workspace index

Research on MeowKit, 2026-11-15. Started on `feat/rust-plan-state-verbs` @ `fc278b31`; the
checkout was moved to `main` @ `c7ff0a9e` during the work (not by this research), and `main`
is the baseline of every deliverable. Research only: nothing outside this directory was
modified, and no recommendation has been implemented. The directory is untracked; commit, move
or delete it as you see fit.

## Status

| Stage | State |
| --- | --- |
| 1 Repository and environment verification | done — `evidence-ledger.md` |
| 2 MeowKit baseline audit | done — `findings/D01`–`D05` |
| 3 Independent research | done — `findings/D06`–`D12` |
| 4 Critical cross-examination | done — `findings/R1` (source claims re-run), `findings/R2` (citations opened at source) |
| 5–8 Alternatives, experiment design, synthesis, recommendations | done — deliverables `01`–`13` |
| 9 Implementation planning | **not started; requires explicit approval** |

## Deliverables

| # | File | What it is |
| --- | --- | --- |
| 20.1 | `01-executive-research-summary.md` | Verdicts on H1–H8, ranked risks, coverage, open questions — start here |
| 20.2 | `02-source-level-architecture-audit.md` | What MeowKit is and does as implemented; hypothesis tested word by word |
| 20.3 | `03-foundation-model-research.md` | Model identity table, capability matrix, model–harness co-evolution |
| 20.4 | `04-harness-comparative-study.md` | Local and external harnesses compared mechanism by mechanism |
| 20.5 | `05-skill-agent-rule-hook-audit.md` | Component-level classification and recommendations (`C-`) |
| 20.6 | `06-cli-and-adapter-architecture.md` | Rust CLI, install lifecycle, per-host truth table (`K-`) |
| 20.7 | `07-observability-and-evaluation-architecture.md` | Signals, host exposure, boundary decision (`O-`) |
| 20.8 | `08-security-and-authority-assessment.md` | Threat model, enforcement classification, mitigations (`S-`) |
| 20.9 | `09-memory-correctness-assessment.md` | Store map, lifecycle, lint, staleness (`Y-`) |
| 20.10 | `10-multi-agent-orchestration-study.md` | Supervisor–Lead–Peer critique, evidence, execution philosophy (`A-`) |
| 20.11 | `11-architecture-decision-records.md` | Ten proposed decision records, none accepted |
| 20.12 | `12-controlled-experiment-plan.md` | Arms, task suite, metrics, E1–E10, probes, statistics — design only |
| 20.13 | `13-prioritized-engineering-roadmap.md` | Ordered items with impact, effort, evidence, risk, dependencies, done-when |

## Evidence

| File | Purpose |
| --- | --- |
| `evidence-ledger.md` | Environment record, baseline change, lead-verified findings |
| `findings/D01`–`D12` | Domain findings with coverage inventories |
| `findings/D02-skills-inventory.csv` | One row per skill, all 128 |
| `findings/R1-critical-review-source-claims.md` | Re-run of 14 source claims: 11 confirmed, 3 weakened, none refuted. Overrides D01–D05 |
| `findings/R2-critical-review-citations.md` | 47 papers, four CVEs and vendor pages opened at source. Overrides D08–D12 |
| `BRIEF.md`, `WRITING-GUIDE.md` | Protocol the agents worked under |

## Known limits of this research

- No controlled experiment was run; deliverable 12 is a design.
- No live Codex or Cursor run, no Windows, no Rust `upgrade` trial.
- Several host-behaviour claims rest on documentation and are listed as probes in 12.
- Deliverables 04, 05, 07 and 08 exceed the 450-line target.
- Domain findings written before the reviews keep their original wording; where they differ
  from `R1`/`R2`, the reviews and the numbered deliverables are authoritative.
