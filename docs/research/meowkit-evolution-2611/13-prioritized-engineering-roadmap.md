# 13 — Prioritised engineering roadmap

Baseline `main` @ `c7ff0a9e`. Nothing here is approved or started. Each row points to the
recommendation that carries the full template (observed problem, source, alternatives,
measurement, revert): `C-` in 05, `K-` in 06, `O-` in 07, `S-` in 08, `Y-` in 09, `A-` in 10,
`M-` in 03, `H-` in 04; `E`/`P` are experiments and probes in 12; `ADR-` in 11.

## How to read it

- **Evidence**: V = verified by source or execution and confirmed by the reviewer;
  V* = verified by one auditor or compiler, not re-reviewed; D = host documentation only;
  R = research-supported; H = hypothesis.
- **Effort**: S = under a day, M = days, L = weeks.
- **Type**: FIX = mechanical defect, act now · HARDEN = strengthen an existing control ·
  CLAIM = make wording match mechanism · DELEGATE = hand to host · EXP = experiment before any
  change · DECIDE = maintainer decision, options in the linked record.
- Where several deliverables recommend the same change, it appears once with all IDs.
- Rows are ordered inside each area by dependency, then by impact per effort.

## Step 0 — probes and a regression baseline (do first; hours)

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | Live probes: does plain hook stdout reach the model; `onFailure` behaviour on crash and timeout; guard reach on other edit tools; whether SessionStart carries the model | P-series, O-10, C-14, K-10 | EXP | High — four later rows depend on the answers | S | D | None | — | A dated probe log with host version; each claim marked confirmed or refuted |
| R-02 | Deterministic enforcement replay suite: one case per bypass class the review confirmed, PASS = host-level block observed | E8, 08 §10 | EXP | High — turns every hardening row into a testable change | S–M | V | None (runs in a throwaway install) | — | Suite runs red on current main for the known classes and is wired as a regression check |

## 1. Correctness and security

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-03 | Narrow the pre-approved permissions; require a prompt for approval stamping, push and force | S-01 | HARDEN | High — removes the no-prompt path to self-approval | S | V | More prompts | — | R-02 case for self-stamp shows a host prompt |
| R-04 | Fail-closed configuration on the three guard hooks, on host versions that support it | S-02, C-06, H-01, K-10 | HARDEN | High — closes timeout and broken-entry-script fail-open | S | D (option) + V (current gap) | Host-version dependent; does not cover Stop-class events | R-01 | R-02 cases for crash and timeout block |
| R-05 | Protect the control plane and tighten path classification: `.claude/` writable under the plan gate, symlink resolution, segment allowlist | S-03, C-11 | HARDEN | High | M | V | False blocks on legitimate kit edits | R-02 | R-02 path cases block; kit self-edits still possible with a plan |
| R-06 | Parse the ship command instead of matching a literal string | S-05, C-07 | HARDEN | Medium–High | S–M | V | Parser false positives | R-02 | All six confirmed evasions trigger the gate |
| R-07 | Close privacy-block and post-write scanner coverage gaps; drop the two false positives | S-06, S-07, C-08, C-09 | HARDEN | Medium | S | V | Pattern churn | R-02 | Listed names blocked; listed false positives pass |
| R-08 | Offer host sandbox and deny rules as shipped optional configuration beside the hooks; document them as the boundary | S-11, S-12, H-08, ADR-01 | DELEGATE | High — the only layer independent of command text | M | D | Sandbox friction; per-host differences | — | A documented, tested optional profile; hooks unchanged |
| R-09 | Make security wording match mechanism in README, rules and CLI output | S-16–S-18, C-01, C-02, ADR-01 | CLAIM | Medium — trust | S | V + D | Reads as weaker | DECIDE row R-31 | Claims audit table in 08 §7 has no open row |
| R-10 | Read-only agents receive write tools through `memory:` | S-09, C-10, Y-10 | DECIDE → FIX | Medium | S | V (count) + D (host behaviour) | Agents that do use memory lose it | R-01 spawn check | Declared and effective tool grants match |

## 2. Reliability

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-11 | Gate 1 exceptions: implement them or retract the documentation | S-04, ADR-08 | DECIDE → FIX | High — documented fast paths do not work today | M | V | Implementing widens the gate; retracting removes a promised path | — | Docs and hook agree; R-02 has a case for it |
| R-12 | State the contract-gate scope and make the hook match | S-20, ADR-08 | DECIDE → FIX | Medium | S | V | — | — | A dated plan without contracts behaves as documented without a local override |
| R-13 | Mechanical clean-ups: dead path references and the checker that misses them, tracked temp files, the deprecated skill still referenced, stale rule and hook statements | C-01–C-05 | FIX | Low–Medium | S | V* | None | — | Checker fails on a seeded dead path; listed items gone |
| R-14 | One source of truth for density by model; reconcile the tier rule with pinned agents; fix the budget unit mismatch | M-01, M-03, C-12, C-13, ADR-07 | FIX | Medium | S | V | None | — | Selector, detector and doc agree for every listed model id |

## 3. Observability

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-15 | Repair misleading signals: the cost figure, per-turn session-end, cumulative counters, schema mismatches, model provenance | O-02–O-04, O-06 | FIX | Medium | M | V | None | — | Documented schema equals emitted events; no figure labelled cost that is not cost |
| R-16 | Budget and loop feedback: make it reach the model, or label it advisory | O-01, S-08, O-13 | DECIDE → FIX | Medium | S | V + D | Extra model-visible text per tool call | R-01 | Probe shows the chosen behaviour |
| R-17 | Treat host telemetry as source of truth; CLI normalises and inspects only; drop logs with no consumer except the bypass log | O-05, O-07, O-09, ADR-04 | DELEGATE | Medium | M | D | Host signal names change | R-15 | Estimate-versus-host comparison (O-11) on ten runs |

## 4. Skill and context efficiency

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-18 | Record which skills are activated | C-16 | FIX | High — nothing about skill value is decidable without it | S | V (no data exists) | Privacy: record names only | — | Activation counts available per session |
| R-19 | Discoverability experiment: activation accuracy against listing pressure, user-only leaves, hub-and-leaf against flat | E7, C-17 | EXP | Medium–High | M | R (weak) + V (machine-dependent overflow) | — | R-18, R-27 | Result with uncertainty; a decision on leaf invocation mode |
| R-20 | Always-on rules ablation and instruction-density dose-response | E2, M-07, C-15, H-03 | EXP | Medium | M | R (one study, 2025 models) | Must keep security and gate rules in every arm | R-27 | Result with uncertainty |

## 5. CLI and portability

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-21 | Derive lifecycle claims from what each bundle registers; per-host rows in the README; record or remove the Cursor downgrade switch; `doctor` shows weakened guards | K-01, K-03, K-04, K-07, ADR-09, ADR-10 | CLAIM + FIX | Medium–High | M | V | None | — | Lifecycle output equals bundle hook config; the two disabling settings turn `doctor` non-green |
| R-22 | State release status and what the checksum covers; resolve the plugin/flat-copy contradiction | K-02, K-05, K-06 | CLAIM | Medium | S | V | None | — | README matches what works today |
| R-23 | Release integrity level and branch protection on the stated root of trust | S-22, ADR-10 | DECIDE | High if a release asset is ever tampered | S–M | V | Process overhead | — | Decision recorded; release guide matches repository settings |
| R-24 | Live Codex and Cursor guard runs | K-08, E10 | EXP | Medium | M | none yet | — | R-02 | Dated report: same payload, same decision per host, or the differences listed |

## 6. Memory

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-25 | Mechanical memory fixes: three doc/code disagreements, the legacy fallback split, the silent lint skip when a store exists, `--prune` implemented or restated, the lint documented as a tripwire | Y-01–Y-05, S-10 | FIX + CLAIM | Medium | S–M | V | None | — | Docs equal behaviour; ship-time lint fails loudly when it cannot run on a non-empty store |
| R-26 | Memory decisions: committed-versus-ships-empty, who may write, agent scopes | Y-10–Y-12, ADR-05 | DECIDE | Medium | S | V | — | — | Decisions recorded |
| R-35 | Memory experiments: instrument reads, then seeded A/B; anchoring, caps and narrow lint extensions only if the A/B shows value | Y-06–Y-09, E6 | EXP | Unknown | M | R (weak) | — | R-26, R-27 | Result with uncertainty |

## 7. Adaptive orchestration

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-28 | The agent nothing spawns and the status protocol nothing checks: keep, wire or remove | A-07, A-08, ADR-06 | DECIDE | Low | S | V | — | — | Decision recorded |
| R-29 | Pipeline ablation at equal token budget and at equal wall-clock; reviewer context; specialist against generic agents | E4, E5, A-01, A-02, A-11, C-18, H-07 | EXP | High — decides the shape of the agent set | L | H | Cost | R-27 | Result with uncertainty |
| R-30 | Gate triggers keyed on risk and reversibility against task size, gates kept | E3, A-09, ADR-08 | EXP | High | L | H | Simulated approver hides real approval behaviour | R-27, R-11 | Result with human interruptions and unauthorised actions reported together |

## 8. Experimental opportunities and enabling work

| ID | Item | Refs | Type | Impact | Effort | Evidence | Risk | Depends on | Done when |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-27 | Maintainer-only evaluation driver and the first-week slice: baseline pilot, then MeowKit against native host on a small original task suite | ADR-03, 12 §9, E1, O-12 | EXP | Highest — first answer to H1; unblocks every EXP row | M | V (nothing exists) | Small suites detect only large effects; cost figures are assumptions | R-01 | A paired result with uncertainty and retained transcripts, stored outside shipped directories |
| R-32 | Density tiers earn their place, or not | E9, M-02, H-04 | EXP | Medium | M | H | — | R-27, R-14 | Result with uncertainty |
| R-33 | Verification-evidence record with a capped stop nudge | A-12, H-05 | EXP | Medium | M | H (design seen in one harness, no outcome data) | — | R-27 | Result with uncertainty |
| R-34 | Head-to-head of overlapping skills against host-native commands | H-06, C-19, C-20 | EXP | Medium | M | D (overlap is nominal) | — | R-27 | Result with uncertainty |

## Maintainer decisions that gate other rows

| ID | Decision | Options in | Gates |
| --- | --- | --- | --- |
| R-31 | Keep "cannot be bypassed" as emphasis for the model, or reword | ADR-01, 08 §7 | R-09 |
| R-11 | Implement or retract the Gate 1 exceptions | ADR-08 | R-30 |
| R-12 | Contract-gate scope | ADR-08 | — |
| R-16 | Should a budget stop work | ADR-04 | — |
| R-23 | Release integrity level | ADR-10 | — |
| R-26 | Memory store intent and writers | ADR-05 | R-35 |
| R-28 | Unused agent and unchecked protocol | ADR-06 | — |
| — | Audit baseline: stay on `main` or pin to the starting branch | 01 | all citations |

## Suggested sequence

1. **Step 0** — R-01, R-02.
2. **Decisions** — the table above; most are an hour of the maintainer's time and unblock fixes.
3. **Act-now set** — R-03, R-04, R-06, R-07, R-13, R-14, R-15, R-18, R-22, R-25. All are small, verified and reversible with git.
4. **Medium set** — R-05, R-08, R-09, R-21.
5. **Evaluation** — R-27, then stop/go on the pilot result before funding R-19, R-20, R-29, R-30.

## Explicitly not on the roadmap

| Rejected or deferred | Why | Record |
| --- | --- | --- |
| An orchestration runtime inside the toolkit | No evidence it would pay for itself; hosts already provide subagents, worktrees and tasks | ADR-06, A-06 |
| A MeowKit observability backend | No demonstrated need; privacy cost; hosts emit the signals | ADR-04, O-08 |
| A vector database or memory engine | The current store has never held content; no study shows file memory insufficient | ADR-05 |
| An eval verb or trace export in the CLI | No demonstrated problem; evaluation is maintainer-only | ADR-03, ADR-10 |
| Supervisor–Lead–Peer adoption | No experiments, cost data or baseline in the source | A-05 |
| New host targets | Portability claims for current hosts are not yet behaviourally verified | ADR-09 |
| Removing or merging skills and agents on judgement | No activation or outcome data; decide after R-18 and R-27 | ADR-02 |
| Removing either human gate | Authority control; evidence does not support removal | ADR-08 |
