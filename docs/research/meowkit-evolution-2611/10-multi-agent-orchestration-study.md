# 20.10 Multi-Agent Orchestration Study (with agent execution philosophy)

Baseline: `main` @ `c7ff0a9e`, 2026-11-15. Compiled from `findings/D11`, `D03`, `D06`, `D07`, `D08`, `D10`, with `R1` and `R2` overriding where they differ. No new research; nothing here was re-run. Finding IDs are cited so each claim can be traced. Evidence labels follow `BRIEF.md`.

## 1. Summary

**Core question: does multi-agent collaboration improve software-engineering outcomes enough to justify its complexity and cost?**

| Tier | What the evidence supports |
| --- | --- |
| Supported (narrow) | Context isolation for exploration and review (a fresh context is cheaper and cleaner than growing the main one) is endorsed by vendors, but its benefit is INFERRED, not ablated (F-D11-05). Worktree isolation beats a shared workspace for parallel writers (CAID soft isolation 55.5 < single 57.2; AIDev merge-conflict data, F-D11-04, F-D11-09). Repeated same-session review is worse than a fresh review, and multi-turn review adds false positives (F-D11-07; weak, see below). |
| Weak | "Multi-agent does not reliably beat single-agent at matched budget on SE" is weak RESEARCH-SUPPORTED: one SE source (2512.08296), a 20-instance SWE-bench Verified subset, 2025 models, and that paper's thesis is task dependence (gains from +80.8% to -70%, mean -0.3%, very wide interval), not "multi-agent trails". "Fresh-context review is about as good as same-session review" is weak: three papers, one author, injected errors, small n; the paper says its null does not establish equivalence (R2 s.6). |
| Positive but cost-confounded | CAID (worktree-isolated manager + engineers): +3.6 to +25.6 points at 1.7x to 4.3x cost, with a fixed iteration budget per configuration, not matched compute (R2 s.2). Claude-only gain is about +6 points. |
| Unknown for current models | Every controlled source predates Opus 5.x / Fable 5.x; newest models studied are Sonnet 4.5 / Opus 4.6 / GPT-5.x / Gemini 2.5. The Supervisor-Lead-Peer layer has no measurement anywhere (NONE). Planning-first vs interleaved for 2026 models, risk-keyed vs size-keyed gating, adaptive vs rigid workflows: no head-to-head found. |

Verdicts (detail in s.8): **H4 = HYPOTHESIS** (not shown to pay for itself as a default; narrow conditions have support). **H3 = HYPOTHESIS** (no head-to-head exists).

Facts about MeowKit as found (s.5): 42 agent definitions, of which the `orchestrator` is never spawned by anything; 22 are one-skill-one-agent forked leaves with real host isolation; the Subagent Status Protocol is requested but nothing checks it; a full interactive cook run asks the model to read roughly 333 KB (~83K tokens, upper bound) of workflow text and stops for a human 5 to 6 times; the repo contains no outcome measurement of any of this (F-D03-12). Absence of measurement is not evidence of no benefit, so most recommendations are EXPERIMENT / DEFER / REJECT (s.9).

## 2. The Supervisor-Lead-Peer (SLP) article

Source: vhlam.com "agent-orchestration-multi-agent-slp" (reachable; R2 s.4). All of this section is from F-D11 s.2 unless stated.

**Claims.** Roles are responsibility plus authority, not personality. Human sets goals and trade-offs. Supervisor watches cross-scope drift and may speak to Peers, but direction changes must return to the Lead's shared state. Lead holds room state, assigns ownership, handles dependencies, judges evidence, owns integration and acceptance. Peers (Implementer, Reviewer, System Architect, Auditor) investigate/design/implement/review and may challenge premises. One owner per changing scope until explicit handover. Briefs separate goal, hard constraints, and current design choice ("a choice is not a requirement"). A reviewer must know which version it reviews. A message such as "I yield" is not evidence; check real state. Escalation chain Peer evidence -> Lead -> Supervisor -> human. Right to dissent, no duty to dissent. Remove a reviewer that rarely changes outcomes. Small changes may be better single-agent.

**Evidence offered.** Three personal projects, one anecdote (47 tests passed, 4 added regressions failed), analogies (bicycle, boat). The author states it is subjective. It cites a graph-engineering survey (2608.21156; R2 confirms it exists and is not validation of SLP). No experiment, baseline, cost data, or failure rates. Model names and Codex multi-agent behaviour the article cites: UNKNOWN (not verified).

**Critique.**

| Claim type | Items |
| --- | --- |
| Testable, and corroborated elsewhere | One owner per scope (CAID soft-vs-worktree isolation; the C-compiler run lost work when agents overwrote each other, F-D11-09/10; MeowKit's own rule 1). Brief structure goal/constraint/choice (targets MAST "disobey task specification" 11.8% and anchoring; Cognition's "share context"; F-D11-01). Reviewer-with-no-outcome-change gets dropped (testable by ablation). Right to dissent without duty (testable via false-positive rate; cf. the multi-turn review result, F-D11-07). |
| Analogy-based | Hierarchy, escalation chain, owner-until-handover transferring from human teams to LLMs. LLM-specific problems (shared training prior, sycophancy, context loss at Lead-to-Peer hand-off) are not addressed. |
| Unsupported | The Supervisor layer: no source anywhere tests it. Internal tension: a Supervisor who can instruct Peers while the Lead holds state recreates the conflicting-direction risk the article itself names. |
| Unaddressed failure modes | Token-cost multiple, latency, correlated errors (all peers one model), context loss at hand-off (named, not mitigated), termination (no section; nearest is "evaluate by chain of change"), who verifies the Lead, human escalation fatigue, Supervisor as bottleneck. The motivating case (vertical dependency) is the setting where the scaling study found multi-agent degraded most. |

**MeowKit mapping.** The orchestrator "never writes code" (`orchestrator.md:3`), so it is a router, not a Lead owning integration; developer-as-Lead plus subagents-as-Peers plus two human gates is the closest fit (F-D11-15).

**Classification for MeowKit: DEFER the layered structure; ADOPT-AS-OPTIONS only the corroborated sub-ideas.** Reasons: (1) the layer MeowKit would be adding (Supervisor) is the unmeasured one; (2) the corroborated pieces (ownership, brief structure, evidence over messages) are already in MeowKit (`parallel-execution-rules.md` Rule 1; `orchestration-rules.md:22-70` delegation template with ownership and acceptance criteria) and cost nothing beyond text; (3) it is a practitioner proposal, not a standard, by the author's own account.

## 3. Evidence table

R2 grade key: C = confirmed against the source; P = partial (number or scope corrected); "weight" is my summary of R2 s.6.

| Source | Measured (tasks, models, budget control) | Result (R2-corrected) | R2 status / grade | Relevance | Limitation |
| --- | --- | --- | --- | --- | --- |
| MAST 2503.13657 | Failure modes in 1,642 traces, 7 MAS frameworks, kappa 0.88; 2025 frameworks | 14 modes; spec/loop/termination ~44%, inter-agent ~32%, verification ~24%; ChatDev role-spec fix +9.4, added high-level verification +15.6 | C | Failure taxonomy; most failures are not coordination-specific | No single-agent control; LLM judge; cannot say MAS fail more |
| Scaling 2512.08296 (Kim et al.) | 260 configs, 6 benchmarks, 8 models (GPT-5 family, Gemini 2.5, Sonnet 4/4.5); tokens matched. SWE-bench Verified part is a **20-instance subset** | All MAS -2% to -15% vs single 0.522 on that subset; mean delta across all benchmarks -0.3% (CI -58.7..+77.2); finance +80.8%, PlanCraft -39..-70%; error amplification 17.2x (independent) to 4.4x (centralized) | P: the abstract claims task-structure dependence, not "MAS trails SAS" | Closest SE matched-budget comparison | n=20; 2025 models; iteration budget split among agents (favours single); R^2 about 0.4 |
| Equal-budget reversals 2604.02460, 2505.18286, 2605.08478 | Multi-hop QA at equal thinking tokens; MAS-vs-SAS across apps; 216 Codeforces tasks (k-shot vs agentic) | Single >= MAS on QA at equal tokens; MAS edge shrinks with stronger LLMs; k samples beat agentic reasoning | C | "Gains are compute" hypothesis | None is SE multi-agent; Gemini budget-control artefacts flagged; Codeforces is not multi-agent |
| 2609.04217 | ALFWorld, frozen 7B backbone | 0.769 vs 0.754, p=0.80 | **ID/date anomaly (2609 prefix, submitted 25 Jun 2026); ZERO weight** | none | Excluded. 2603.13258 has the same kind of anomaly (R2 s.1) |
| CAID 2603.21489 (Neubig) | Manager + 2-4 engineers in worktrees; PaperBench, Commit0-Lite; Claude 4.5, GLM 4.7, MiniMax 2.5; fixed iteration budget per config, **not matched compute** | +3.6 to +25.6 points (best cases MiniMax 2.5); Claude 4.5 +6.0/+6.1; cost **1.7x to 4.3x**; soft isolation 55.5 < single 57.2 | P (stale cost range 1.7-2.8x corrected) | Real SE gain on decomposable long-horizon work; isolation required | Preprint; cost-confounded; 8 engineers worse than 4 (summariser-read, DOCUMENTED not re-read) |
| Anthropic research system (2025-06-13) | Opus 4 lead + Sonnet 4 workers vs Opus 4, internal research eval | +90.2%; ~15x tokens; tokens explain 80% of variance; "most coding tasks involve fewer truly parallelizable tasks" | C (vendor) | Breadth research gain | Non-SE; internal eval; old models |
| Parallel-coding conflicts 2607.04697 | 747 co-active PR pairs from AIDev-pop | Textual conflict 41.7% cross-agent vs 19.8% same-agent | C (scope) | Integration cost of parallel agents | Observational PR data; cross-agent pairs only 0.5% of pairs in 122 repos |
| Anthropic C-compiler (2026-02) | 16 Opus 4.6 agents, ~2,000 sessions, ~$20k | Built; frequent conflicts, duplicated work, agents overwriting each other on the same bug | DOCUMENTED | Peer swarm feasible only with a near-perfect test oracle | No single-agent control |
| Cross-Context Review 2603.12123 | 30 artifacts, 150 injected errors (code, docs, scripts), Claude Opus 4.6; single author | F1 CCR 28.6, repeated same-session 21.7, single same-session 27.1 (p=0.26), subagent 23.8 (p=0.057) | C; v1 claimed CCR > single (p=0.008), reversed in revision, one unverifiable run excluded | Fresh context vs same-session | Single author; injected errors; weak |
| 2603.16244 | Same design, multi-turn reviewer Q&A | +62% false positives (8.47 vs 5.23), F1 0.303 vs 0.376 | C (one variant; Korean-language artefacts) | Do not add review rounds | Same single author |
| 2610.01471 | 900 sessions; Opus 4.6, GPT-5.4, Gemini 2.5; artefacts from one Opus 4.6 author | Fresh+cross-model 56.7% vs two same-model 42.7% (Holm p=.006); Jaccard 41.2%; top cross-model not significantly different from fresh same-model | C; abstract: null "does not establish equivalence"; capability and model difference confounded | Cross-model review adds complementary coverage | Weak; same author; planted errors |
| Persona study 2311.10054 | 162 roles, 4 LLM families, 2,410 factual QA | Personas do not improve; effect largely random | C | Specialist prompts add little | 2023 models; QA not coding |
| Debate 2502.08788, 2311.17371 | 5 debate methods x 9 benchmarks x 4 models | Debate often not better than CoT/self-consistency; heterogeneity helps | C | Debate not a default | Reasoning tasks, not SE |
| Clarification 2502.13069, 2603.26233 | Ambig-SWE; underspecified SWE-bench Verified, simulated user | Interaction up to +74%; decoupled detector reaches 69.40% | C | Conditional asking needs a detector | Single preprints; simulated users |
| PR-metadata bias 2603.18740 | 33 CVEs / 20 projects; Claude Code + CodeRabbit | 97% (32/33) with LLM-refined attacks | C | Author-supplied narrative is an attack surface for reviewers | Adversarial setting |
| Cognition (2025-06, 2026-04-22) | Position posts | Parallel writer swarms fragile; single-threaded writes plus clean-context review, escalation, manager/child delegation endorsed | C (vendor) | How a vendor moved | Company-reported numbers |
| Anthropic harness (2026-03-24) | Planner/generator/evaluator on app builds; N=1 each | Solo 20 min/$9 vs full 6 h/$200; sprints and context resets removed with Opus 4.5/4.6; planner and a single-pass evaluator kept | C (vendor) | Scaffold removal as models improve; independent evaluator retained | Anecdote; no variance |
| Auto mode (2026-03-25) | Approval behaviour; classifier | Users accept 93% of prompts; classifier FNR 17% (n=52 real overeager), FPR 0.4% | C (vendor self-report) | Gate fatigue; risk-keyed gating | n=52 |
| Host docs (sub-agents, agent-teams) | Documentation | Subagents: fresh context, `isolation: worktree`, nesting 3, tool allow/deny. Teams: experimental, same-file edits overwrite, start with 3-5 | DOCUMENTED | What the host already provides | Not executed |

## 4. Six-configuration comparison

"NONE" = no evidence found. Cost multiples are from the cited sources; INFERRED where marked.

| Configuration | Correctness evidence | Cost multiple | Latency | Characteristic failure modes | Evidence grade |
| --- | --- | --- | --- | --- | --- |
| 1 Single agent | Matched-budget SWE-bench subset: at or above all multi-agent arms (0.522 vs <=0.511; n=20, 2025 models). Task-dependent elsewhere | 1x | Lowest | Context rot; self-review leniency; anchoring | Weak RESEARCH-SUPPORTED |
| 2 Single + reviewer (fresh context) | Vendor reports gains (Anthropic, Cognition); CCR F1 28.6 vs 21.7-27.1, some n.s.; no real-defect study | NONE measured; INFERRED about 1.3x-2x (one extra session) | +1 pass | False-positive growth on repeated rounds (+62%); same-model correlated errors; framing bias | Weak (one author; vendor claims) |
| 3 Lead + workers (isolated) | CAID +3.6..+25.6 (Claude ~+6); research +90.2% (non-SE); matched-budget SWE subset: centralized -3.1% | 1.7x-4.3x (CAID); ~15x (research); ~2.9x overhead centralized in scaling study | Often higher wall-clock (CAID) | Over-prescriptive lead; lost context at hand-off; merge conflicts; needs test oracle | Medium-low; gains cost-confounded |
| 4 Lead + peers (decentralized / teams) | SWE subset -5.4% matched; C compiler worked with oracle (no control) | Decentralized overhead 263% (scaling); ~$20k project | High coordination | Error amplification up to 7.8x; duplicated work; overwrites | Weak |
| 5 Supervisor-Lead-Peer | NONE | NONE | NONE | Not measured; conflicting-direction risk is the article's own | NONE (analogy plus one practitioner) |
| 6 Adaptive orchestration | Cascading single<->multi +1.1-12% accuracy, -20% cost (2505.18286, o3/Gemini 2.5 era, mostly non-coding); a predictor picks the best architecture for 87% of held-out configs (scaling paper, R^2 ~0.4) | 1x to 3x by routing | Variable | Router misclassification; routing overhead | Weak; NONE for SE on current models |

## 5. MeowKit as found

### 5.1 What multi-agent structure exists

42 agent definitions plus 2 index files in `.claude/agents/` (README "42" is correct; R1, F-D03-01). By class (F-D03-02, F-D03-09):

| Class | Agents | Spawned by what |
| --- | --- | --- |
| Lifecycle, prose-spawned | planner, developer, tester, reviewer, evaluator, shipper, documenter, analyst, security, architect, researcher, ui-ux-designer, project-manager, explore | Skill/reference text tells the model to call `Task(subagent_type=...)`; no hook, CLI or script spawns them (VERIFIED, grep). |
| Opt-in specialists | advisor (only `mk:advise`), athena (`--advice`), brainstormer, journal-writer, git-manager | Prose, 1 to 2 callers each. |
| Never spawned | `orchestrator` | Only documentation references; no `Task(subagent_type="orchestrator")` exists (VERIFIED, F-D03-02). It routes complexity and model tier, and duplicates `agent-detector` and cook Phase 0 (F-D03-08). |
| Executor leaves (22: 16 jira, 5 confluence, story-sizer) | Each pairs a skill with `context: fork` and `agent: <same name>` | Host mechanism; the only `agent:` bindings in the skill tree (VERIFIED + DOCUMENTED). |

**Real isolation versus renamed prompt.** The 22 leaves get a genuine fresh context with the skill body as prompt, plus a pinned model and tool grant (F-D03-03). Among lifecycle agents, a subagent spawned by the host also has a fresh context, so isolation is real when spawned; but planner vs architect differ only by owned artefact and share tools and model, i.e. a renamed prompt (F-D03-08). Developer and reviewer are both pinned `claude-opus-5`, so review is same-model (correlated judgement); only evaluator (observes runtime behaviour) and athena/advisor (different model tier, `fable`) bring different evidence or a different model, and athena/advisor's registry row is "Not yet measured". Model tier is an instruction, not a mechanism: frontmatter `model:` wins, so a trivial task routed to `developer` runs on the pinned model (F-D03-05). Read-only agents (athena, explore, orchestrator) are not structurally read-only because `memory: project` auto-grants Write/Edit (VERIFIED live, R1 s.2: 36 agents set `memory:`, 21 are effectively read-only-made-writable).

**Hooks do run inside subagents** (DOCUMENTED, R2 s.4; R1 resolved the disagreement). So Gate 1 (`gate-enforcement.cjs`) applies to a subagent's Edit/Write, but `SubagentStart` and `SubagentStop` are registered with empty handler arrays (L-03, F-D03-07).

**Coordination state that exists as files:** `tasks/plans/*/plan.md` plus approval receipt; `tasks/reviews/*-verdict.md` bound to HEAD; `tasks/contracts/*` (autobuild); `.meowkit/state/` pointers; host TaskCreate/TaskList. No inter-agent messaging file exists; team mode is opt-in text in `mk:team-config` (`parallel-execution-rules.md` Rule 7).

**Status protocol.** `agent-conduct.md` A1 requires every subagent to end with a Status block. Nothing parses it (grep across hooks, CLI source, scripts; only a rule-survival oracle checks the text is still in the rule; F-D03-07). Effect on outcomes: UNKNOWN.

### 5.2 Cost of a default cook run (F-D03-11, upper bounds INFERRED)

| Item | Figure |
| --- | --- |
| Workflow text the model is told to load before Gate 2 (phases 0, 1 full, 3, 3.5, 3.6, 4) | ~333 KB, ~83K tokens (bytes/4) |
| Human stops, default mode | 5 to 6: Gate 1, Post-Build, Gate 2, ship request, close request; +Post-Test under TDD |
| Mechanically backed transitions | 2 of 9 (Gate 1 for source edits; Gate 2 at `git commit/push/merge`). Simplify, Verify, Review-as-process, Reflect, tier declaration are prose (F-D03-10) |
| Outcome measurement | None: 0 of 27 dead-weight registry rows carry a numeric delta; benchmark results directory is empty (F-D03-12, R1 item 13) |

Caveat: "told to load" is not "loaded"; a model may read less. The figure bounds the text cost, not measured tokens.

### 5.3 Parallel rules versus the evidence

| Rule (`parallel-execution-rules.md`) | Evidence | Match |
| --- | --- | --- |
| 1 Zero file overlap (staged mode as alternative) | AIDev: cross-agent conflict 41.7% vs 19.8%; CAID soft isolation below single agent; C compiler overwrites (all RESEARCH-SUPPORTED / DOCUMENTED, observational or cost-confounded) | Consistent |
| 3 Worktree per agent | CAID worktree isolation is the stated enabling mechanism; host offers `isolation: worktree` | Consistent; host alternative exists |
| 5 Full test suite after merge | CAID and C compiler both depend on a test oracle; Anthropic: verifier must be near-perfect | Consistent |
| 2 Max 3 parallel agents | No study measures three. CAID: 8 engineers worse than 4 (summariser-read). Host docs suggest 3 to 5. Cost "scales linearly" is asserted, not cited | **No measurement** |
| 6 Only COMPLEX tasks | Depends on the tier, which is an instruction; supported in direction by "most coding tasks involve fewer truly parallelizable tasks" (vendor) | Plausible, unmeasured |
| 4 Gates never parallel | Authority control, not an outcome claim | Out of scope for this evidence |

### 5.4 Machine artefacts (not kit properties)

The user-global `~/.claude` toolkit shadows or competes with 8 same-named agents (planner, researcher, tester, and others; project beats user in host precedence, F-D03-19); `CLAUDE_CODE_SUBAGENT_MODEL` in user settings is overridden by frontmatter; the untracked `.claude/settings.local.json` sets LEAN (L-14); SessionStart "Model: not detected" in the desktop host (L-10). These affect what a local run looks like, not what the kit ships.

## 6. Coordination-function decision table

Question per function: what is the cheapest sufficient representation, and does it need another model instance? Only the bold rows genuinely do.

| Function | Cheapest sufficient representation | Evidence grade | MeowKit today |
| --- | --- | --- | --- |
| Routing / triage | Rule + model self-classification; optionally a deterministic hook | HYPOTHESIS | Four overlapping routers (orchestrator agent never spawned, agent-detector, scale-routing, cook Phase 0), none mechanically run (F-D03-08) |
| Planning | Skill (plan-creator) + task artefact; host `ExitPlanMode` | Weak (vendor: planner kept when scaffolds were removed) | Skill + `tasks/plans/` + receipt |
| Decomposition | Skill / the Lead model itself | NONE for separate instance | In cook / plan-creator prose |
| Delegation brief | Template (goal, constraints, current choice, ownership, acceptance) | Corroborated by MAST and SLP (practitioner) | `orchestration-rules.md:22-70`, `mk:delegate` |
| **Context isolation** | Host subagent / `context: fork` | DOCUMENTED + INFERRED; no ablation | 22 forked leaves; lifecycle agents when spawned |
| **Independent review** | Deterministic oracle first; then fresh-context reviewer, diff and spec; cross-model optional | Weak (single-author); vendor-endorsed | `reviewer` same model as developer; evaluator for runtime evidence |
| Verification | Tests, build, hooks; evidence ledger (hermes) | Weak; ledger HYPOTHESIS | `mk:verify` (prose); pre-ship runs checks at commit |
| Decision ownership | One writer per scope; human for goal/cost | Cognition 2026, CAID, C compiler | Rule 1 ownership; Lead role implicit in developer |
| Task ownership | Task file / host task list | DOCUMENTED (C compiler, teams) | Plan files; TaskCreate ritual |
| Shared state | Files, git, host task list | DOCUMENTED | Plans, verdicts, state pointers; no mailbox |
| Escalation | Rule with explicit triggers + human; optional stronger-model consult | NONE for effect | Gates; athena `--advice` (unmeasured) |
| Conflict resolution | Zero-overlap ownership, worktrees, post-merge tests | RESEARCH-SUPPORTED, observational | Rules 1, 3, 5 |
| Termination | Explicit stop/verify criteria; bounded nudges | MAST: unaware-of-termination 12.4%, premature 6.2% | Gate prose; no loop cap on a cook run |
| **Parallel execution** | Host `isolation: worktree` + decomposable task + oracle | Medium-low (CAID, cost-confounded) | Rules 1 to 6; `mk:worktree` text |
| **Cross-model second opinion** | A different-model instance | Weak (debate heterogeneity non-SE; one SE preprint) | athena/advisor on `fable`, unmeasured |
| Supervision of a Lead | Human + telemetry | NONE for a model | None |

Reading: of fifteen functions, three or four need another model instance (isolation, independent review, parallel execution, cross-model opinion). The rest are representable as skills, rules, hooks, files, or host features. Nothing here argues for a runtime inside the toolkit. Persona-based specialisation is absent from the list because the only study (QA, 2023 models) finds no benefit and no SE ablation exists (F-D11-06).

## 7. Execution philosophy

### 7.1 The proposed loop

UNDERSTAND -> ACT -> INSPECT -> ADJUST -> ACT, with clarification, escalation, and termination as conditional exits. Compared with:

| Approach | Evidence for current models |
| --- | --- |
| Plan-then-execute (mandatory upfront plan) | No SE ablation of upfront plan vs interleaving for frontier models (UNKNOWN, F-D11-14). Anthropic kept the planner while removing sprints (vendor, N=1). Requirement omission and weak self-verification are the main bottlenecks in E2EDevBench (2511.04064; abstract-level). Spec-first: one workshop-grade study reports no defect reduction, a vendor-adjacent study reports a merge-rate gain; both LOW |
| Interleaved reason-act | No SE head-to-head found |
| Fixed phase-gated workflow (MeowKit) | Neither qwen-code nor the DeepSeek harness nor hermes nor rig ships rigid phase gates (F-D06-26, F-D07-01); none ships named specialist subagents either (F-D06-28, F-D07-08, rig subagents off by default F-D07-24). qwen's SWE-bench Verified stayed within a 1.4-point spread over seven releases while subagents, hooks and memory were added (F-D06-25; DOCUMENTED, benchmark insensitive to long-horizon work). These absences are not evidence that gates are bad; they show other projects chose not to build them |
| Risk-keyed gating | Vendor's own answer to approval fatigue (action-class rules) |

**Approval gates.** Users accept 93% of manual prompts; the auto-mode classifier has a 17% false-negative rate on 52 real overeager actions and 0.4% false positives (vendor self-report, R2 s.4). That supports "automation is evidence, never authority", which is what `gate-rules.md` already says (Gate Authority Invariant), and it supports the concern that frequent human prompts become rubber stamps. It does not measure a plan-approval gate or a review verdict gate specifically.

**Clarification.** Models cannot reliably tell under-specified from well-specified tasks and default to non-interactive (Ambig-SWE, F-D11-12); a decoupled detector helped (single preprint, simulated users). The cost of over-asking is unmeasured.

**Hermes and others on completion checks.** Hermes uses a passive verification-evidence ledger plus a stop nudge capped at 3, no human gate and no reviewer agent; effectiveness unmeasured (F-D07-02; HYPOTHESIS that it helps). dsh retired a team mailbox for a task board (F-D06-29; history INFERRED). Neither is outcome evidence.

### 7.2 Five workflow variants (qualitative; every outcome cell is unmeasured)

| Variant | Described as | Planning/approval | Human stops | Isolation | Correctness evidence | Cost evidence |
| --- | --- | --- | --- | --- | --- | --- |
| A Minimal instructions | Host-native session, short rules | Host plan mode optional | Host defaults | Host subagents on demand | NONE (no head-to-head) | NONE |
| B Existing MeowKit workflow | 7 phases, 2 hard gates, mandatory simplify/verify | Hook-backed Gate 1 | 5 to 6 | Prose-spawned agents | NONE (0/27 registry rows measured) | ~83K tokens of workflow text (upper bound); no run-level measurement |
| C Adaptive | Loop above, steps skipped on need | Conditional | Fewer, trigger-based | Host | NONE | NONE |
| D Risk-sensitive | Gates keyed to action risk and reversibility | Gates only at irreversible / security-posture actions | Fewer, fatigue-aware | Host | NONE | NONE |
| E Multi-agent | Lead + workers (config 3) or teams | Plan + decomposition | Plan gate | Worktrees | CAID-type gains on decomposable tasks, cost 1.7x-4.3x; SE matched-budget neutral-to-negative on a small subset | See s.4 |

### 7.3 Gates as authority controls: option for the maintainer

MeowKit's two human gates are authority controls (who may approve plan and ship), not just quality steps. Gate 1 fires on any source edit without a fresh receipt; Gate 2 on commit/push/merge. Today the human stop count and the "non-trivial" trigger are keyed to task size and phase (">2 files OR >30 min", `CLAUDE.md`), a trigger with several competing definitions (F-D03-13), and which the hook ignores (it blocks a one-line source typo, F-D03-14, R1 item 5).

Option space, not a recommendation to remove either gate:

| Option | What changes | Trade-off |
| --- | --- | --- |
| Keep as is | Both gates, size/phase trigger | Known cost (5-6 stops, one-line fixes need a plan); consistent authority story |
| Key gate trigger on risk/reversibility | Same two gates; trigger via risk flags and blast radius (already in `risk-checklist.md`) instead of file count | Fewer stops on low-risk work; needs a reliable risk classifier, which would itself be a model or heuristic with a miss rate (17% FNR for the vendor classifier on its test set); weakens predictability |
| Hybrid | Gate 2 stays unconditional (as `gate-rules.md` states, no exceptions); Gate 1 trigger keyed on risk | Preserves the ship boundary while testing the plan boundary |

This is a maintainer design decision. Evidence is indirect (fatigue data, vendor practice); no head-to-head on outcomes.

## 8. Verdicts

**H4 (multi-agent coordination improves complex engineering tasks enough to pay for itself): HYPOTHESIS, not demonstrated as a default for current models.** What the sources actually are:

| Count | Sources | Model generations |
| --- | --- | --- |
| 1 confirmed SE matched-budget comparison (negative to neutral on a 20-instance subset; paper thesis is task dependence) | 2512.08296 | GPT-5 family, Gemini 2.5, Sonnet 4/4.5 (2025) |
| 1 confirmed competitive-programming comparison (agent vs k-shot, not multi-agent per se) | 2605.08478 | not stated in R2 |
| 2 confirmed non-SE matched-budget or scaling sources | 2604.02460, 2505.18286 | Qwen3, R1-distill, Gemini 2.5; o3 / Gemini 2.5 Pro era |
| 1 excluded (ID/date anomaly) | 2609.04217 | zero weight |
| Positive, not matched budget | CAID (3 models: Claude 4.5, GLM 4.7, MiniMax 2.5; +3.6..+25.6, 1.7x-4.3x); Anthropic research system +90.2% (non-SE, Opus 4 / Sonnet 4) | 2025 to early 2026 |
| Current frontier | None: no source tests Opus 5.x / Fable 5.x for multi-agent vs single | UNKNOWN |

Calibrated statement: "not reliably better at matched budget" is weak RESEARCH-SUPPORTED; "does not beat single-agent" for 2026 models is HYPOTHESIS; the decomposition/isolation case is contested, not refuted; supported conditions are narrow (decomposable work, test oracle, isolated workspaces) and cost 1.7x to 4.3x.

**H3 (adaptive workflows outperform rigid gated workflows): HYPOTHESIS.** Independent confirmed sources that compare adaptive against rigid on SE outcomes: **0**. Adjacent single sources: Anthropic's scaffold removal with newer models (vendor, N=1 per run, planner and evaluator kept), qwen's flat SWE-bench series across releases (benchmark may be insensitive), vendor gating practice keyed to action risk. Model generations: Opus 4.5/4.6 (Anthropic); the qwen series is one model across releases. Nothing isolates "adaptive vs rigid" as a variable.

## 9. Recommendations

Each is an option for the maintainer unless stated. Template fields per `WRITING-GUIDE.md`; shared fields are compacted. None proposes removing a security control. An in-toolkit orchestration runtime is classified explicitly in A-06.

### A-01 EXPERIMENT: matched-budget pipeline ablation

| Field | Content |
| --- | --- |
| Observed problem | Default cook pipeline = fixed lead+worker chain (`orchestrator.md:64`); ~83K-token workflow text, 5-6 stops, no outcome measurement (F-D03-11/12) |
| Affected source | `.claude/skills/cook/`, `.claude/agents/orchestrator.md:64` @ `c7ff0a9e` |
| Causal hypothesis | Extra hops and phases add cost without lift for current models (HYPOTHESIS) |
| Proposed change | None to code. Run arms: host-native single agent; MeowKit default; single agent + MeowKit rules only (no subagents), on ~30 repo tasks, fixed model and token cap, >=5 trials, deterministic oracle |
| Evidence | F-D11-02, F-D11-04, F-D03-12 (HYPOTHESIS) |
| Alternatives | Do nothing; adopt A-09 first |
| Expected benefit | First outcome data on H1/H3/H4 for this kit |
| Measurement | Pass rate, tokens, wall-clock, human stops, cost; paired analysis |
| Risks | Task set not representative; model generation drift. No security impact |
| Revert | Discard results |

### A-02 EXPERIMENT: reviewer context and model

| Field | Content |
| --- | --- |
| Observed problem | Reviewer and developer are both pinned `claude-opus-5`; no SE evidence on whether the reviewer should see author rationale; fresh-context evidence is weak (single author) |
| Affected source | `.claude/agents/reviewer.md`, `.claude/skills/review/` @ `c7ff0a9e` |
| Causal hypothesis | Author narrative anchors a same-model reviewer; different model adds complementary coverage (HYPOTHESIS; 2603.18740, 2610.01471) |
| Proposed change | Arms on ~40 seeded-defect PRs: same-session self-review; fresh diff+spec only; fresh + author rationale; different-model fresh; tests-only |
| Evidence | F-D11-07, F-D08-12, R2 s.6(d) |
| Alternatives | Keep reviewer unchanged (Gate 2 is not a quality-only control) |
| Expected benefit | Informs whether an independent model instance for review pays for itself |
| Measurement | F1, false-positive rate, cost |
| Risks | Synthetic injected defects; do not use the outcome to remove the reviewer without a natural-defect arm |
| Revert | None needed |

### A-03 KEEP: zero-overlap, worktree isolation, post-merge tests

| Field | Content |
| --- | --- |
| Observed problem | None found; Rules 1, 3, 5 agree with CAID, AIDev, C-compiler evidence |
| Affected source | `.claude/skills/cook/references/parallel-execution-rules.md:7-86` |
| Evidence | F-D11-04, F-D11-09 (RESEARCH-SUPPORTED, observational / cost-confounded) |
| Alternatives | Delegate worktree creation to host `isolation: worktree` (see A-11) |
| Risks / Revert | n/a |

### A-04 EXPERIMENT: the cap of three

| Field | Content |
| --- | --- |
| Observed problem | "Max 3" (Rule 2) has no direct measurement; the "costs scale linearly" rationale is uncited |
| Affected source | `parallel-execution-rules.md` Rule 2 |
| Causal hypothesis | Returns diminish at about 4 workers (CAID 8 < 4, summariser-read, HYPOTHESIS for MeowKit) |
| Proposed change | Test 2/3/5 worktree workers on ~15 decomposable multi-module features with a known file graph; alternative: cap by independent task count |
| Evidence | F-D11-09; DOCUMENTED host guidance 3 to 5 |
| Expected benefit | A measured number or a better rule |
| Measurement | Integration failures, conflicts, duplicated work, pass rate, cost |
| Risks / Revert | Rule text only; revert the edit |

### A-05 DEFER: Supervisor layer and agent-teams adoption

| Field | Content |
| --- | --- |
| Observed problem | SLP is attractive but NONE-graded; host agent teams are experimental and disabled by default (F-D11-08) |
| Proposed change | Do not add a Supervisor role. If wanted, test it only against lead+workers on vertically dependent tasks (10 tasks x 5 trials) |
| Evidence | s.2, s.4 row 5 (NONE) |
| Alternatives | Use host teams for research/review debugging only (docs' own fit) |
| Measurement / Risks / Revert | Exp 6 in F-D11 s.8; no code change |

### A-06 REJECT: an orchestration runtime inside the toolkit

| Field | Content |
| --- | --- |
| Observed problem | Whether MeowKit should build its own scheduler, mailbox, or team runtime |
| Evidence | No source shows a toolkit-resident runtime beats host features; host already provides subagents, worktrees, task list, teams, hooks (F-D10-11); dsh retired a team mailbox for a task board (F-D06-29); `mk:orchestrate` itself says it is "not a daemon, scheduler, or new runtime" (F-D11-15). Compelling evidence would be A-01 + A-04 showing multi-agent lift at acceptable cost |
| Alternatives | Skills + hooks + CLI state + host-native capabilities |
| Revert | n/a (nothing built) |

### A-07 `orchestrator` agent that nothing spawns (maintainer choice; mechanical grounds exist)

| Field | Content |
| --- | --- |
| Observed problem | `orchestrator` is never the target of any spawn; its routing duplicates agent-detector, scale-routing and cook Phase 0 (F-D03-02, F-D03-08, VERIFIED grep) |
| Affected source | `.claude/agents/orchestrator.md`; references in `model-selection-rules.md`, `after-detection.md` |
| Proposed change | Options: (a) remove the agent and keep one Phase-0 routine; (b) keep it and wire one real spawn; (c) keep as documentation only. Classification: REMOVE is justified on mechanical grounds, but which of a/b/c is a design choice |
| Evidence | F-D03-02 (VERIFIED) |
| Alternatives | Do nothing: cost is ~one listing entry |
| Expected benefit | One fewer unexecuted router and a smaller Phase-0 surface |
| Measurement | Grep for spawn sites; Phase-0 token load before/after; misroute rate on labelled tasks |
| Risks | Docs/index references must be updated; no security impact |
| Revert | Restore the file |

### A-08 IMPROVE (option): status protocol nothing checks

| Field | Content |
| --- | --- |
| Observed problem | A1 requires a Status block; no parser exists; `SubagentStop` handlers are empty (L-03, F-D03-07, VERIFIED) |
| Affected source | `.claude/rules/agent-conduct.md` A1; `.claude/settings.json` hook block |
| Proposed change | Either (a) a warn-only `SubagentStop` check that logs missing blocks, or (b) downgrade the "MUST" wording to a convention. Note the host does not honour `onFailure:"block"` for `SubagentStop` (R2 s.4), so any check there is advisory |
| Evidence | F-D03-07 (VERIFIED); effect of the protocol on outcomes UNKNOWN |
| Alternatives | Do nothing |
| Expected benefit | Know the real rate of valid blocks before relying on the protocol |
| Measurement | % of subagent replies with a valid block |
| Risks | Parsing false positives; observer-only so no blocking risk |
| Revert | Remove the hook entry |

### A-09 EXPERIMENT: key gate triggers on risk/reversibility versus task size

| Field | Content |
| --- | --- |
| Observed problem | Size/phase trigger; one-line typos need a plan; approvals accepted 93% (vendor) |
| Affected source | `CLAUDE.md` Planning trigger; `gate-rules.md`; `lib/core/plan-gate.cjs` @ `c7ff0a9e` |
| Proposed change | Not a change to the gates. Experiment: 30 tasks containing a few irreversible actions, arms size-keyed / risk-keyed / no gate (with a simulated approver), per s.7.3 option table |
| Evidence | F-D11-13, F-D03-13/14 (HYPOTHESIS) |
| Alternatives | Keep as is; hybrid (Gate 2 unconditional) |
| Measurement | Dangerous-action pass-through, interruptions, completion |
| Risks | Security-relevant; no removal on cost grounds alone; classifier miss rate |
| Revert | Not applicable until a change is chosen |

### A-10 EXPERIMENT: conditional clarification with a detector

| Field | Content |
| --- | --- |
| Observed problem | Models do not reliably detect under-specification; MAST fail-to-ask 6.8% |
| Proposed change | Arms on ~40 underspecified tasks: never ask / always ask / conditional (skill checklist) / plan gate |
| Evidence | F-D11-12 (single preprints) |
| Measurement | Resolve rate, question count, human time |
| Risks / Revert | Skill text only |

### A-11 EXPERIMENT / DELEGATE TO HOST (candidate): specialist agents and host-native isolation

| Field | Content |
| --- | --- |
| Observed problem | No evidence personas help; neither qwen-code, the DeepSeek harness, hermes nor rig ships named specialists or phase gates; host provides `Explore`, `isolation: worktree`, task list |
| Affected source | `.claude/agents/*` (planner vs architect, brainstormer vs researcher, explore, project-manager), `mk:worktree` |
| Proposed change | Compare named specialist vs generic child vs single agent on the same tasks; where host features match, prefer them. Specific consolidations belong to the agents deliverable (D03 decisions) |
| Evidence | F-D11-06, F-D06-28, F-D07-08, F-D10-11 (HYPOTHESIS for benefit of removal) |
| Alternatives | Do nothing; keep |
| Risks | Specialisation may carry value outside QA (unmeasured in SE) |

### A-12 EXPERIMENT: evidence ledger plus capped stop nudge in Phase 3.6

| Field | Content |
| --- | --- |
| Observed problem | Phase 3.6 Verify is prose with no hook requiring it (F-D03-10) |
| Proposed change | Record verification commands per session; one bounded re-prompt (hermes caps at 3) when code was edited without fresh evidence; keep the human Gate 2 |
| Evidence | F-D07-02 (VERIFIED as source; effectiveness HYPOTHESIS) |
| Measurement | "Claimed done without running checks" rate with and without the nudge |
| Risks | Re-prompt loops; adds a hook; no authority granted to automation |
| Revert | Remove the handler |

## 10. Not covered / open questions

Not covered: no experiment run; OpenAI/Google multi-agent guidance PDFs not read; ESEM 2026 spec-vs-defect body unread; EvoMAS (2602.06511) not opened; Chroma context-rot and Anthropic C-compiler post not opened by R2; hermes kanban queue and dsh `.agents/notes` mailbox-retirement rationale not read; MeowKit's `mk:party`, `mk:team-config`, `mk:delegate`, `mk:workflow-orchestrator` bodies were not read by D11; Rust `doctor` not executed.

Open questions:

1. Do 2026 frontier models (Opus 5.x, Fable 5.x, GPT-6) still show non-positive matched-budget returns for multi-agent on realistic SE tasks? (2512.08296 used a 20-instance subset and 2025 models.)
2. Does a reviewer that sees the author's reasoning detect fewer defects than one that sees only the diff? (No SE study.)
3. What is the real cost of over-asking, and what is the optimal question rate?
4. Is the cap of three right for this kit?
5. Does the status block change outcomes at all?
6. Is `claude-opus-5` (no minor) a resolvable model ID, and does `memory:` override an explicit `tools:` allowlist on current builds? (F-D03 E2/E3, UNKNOWN.)
7. Who wins when a user-global workflow and MeowKit's disagree? (Hooks win on source edits; prose conflicts unresolved, F-D03-21.)
