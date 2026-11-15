# 20.3 Foundation Model Research Report

Date 2026-11-15. Baseline: `main` @ `c7ff0a9e`. Compiled from `findings/D08`, with D02, D03, D06, D07, D09, R1 and R2. R2 overrides the researchers on what any citation says; every R2 correction is applied below. No new research was done. Evidence labels follow `BRIEF.md`; finding IDs are cited so each claim can be traced.

## 1. Summary

1. **Model names are volatile; the harness is part of every score.** Vendors now publish scores under a named harness (Claude Code, mini-swe-agent). A number without model, harness, budget and date is not comparable (F-D08-01, F-D08-10).
2. **Leaderboards overstate real-world quality.** Maintainer-merge gap +24.2 pp (METR, models up to Sonnet 4.5 / GPT-5), 31% of Terminal-Bench 2.0 tasks defective, 6 pp from infrastructure alone, and OpenAI stopped reporting SWE-bench Verified (secondary). All pre-date the current model generation, so the size of the gap today is UNKNOWN.
3. **H2 ("more scaffolding is not always better for newer models") is supported only in a narrow form**: for prescriptive, always-on instruction text. It is not shown for operational scaffolding (verification, isolation, approval). No study varies one scaffold across weak and strong models at fixed budget (section 6).
4. **What persisted as models improved were operational mechanisms**: an independent evaluator, a planner for scope, ground-truth verification, isolation, approval for irreversible actions. What decayed were cognitive scaffolds: context resets, sprint decomposition, "think harder" lines.
5. **MeowKit's model handling is partly broken for mechanical reasons, independent of H2.** Tier routing is instruction-only; the density selector is an id allowlist that gives newer models more scaffolding and disagrees with the detector; the model was undetected in 112 of 227 local sessions; 12 agents are pinned to one model id (section 7).
6. **No outcome measurement exists in the repo.** So the density matrix cannot be removed for being "unproven"; it can be fixed where it contradicts itself (M-01) and tested before any further decision (M-02).
7. Unread: all vendor system cards (section 9).

## 2. Model identity

Rule used here: a **foundation model** is a trained model with an API/weights id. A **product/harness** is software that drives a model (it has its own scaffolding, tools and budget). An **inference provider** only serves models. Verification column uses R2's status: "vendor page" = R2 re-opened the vendor docs and confirmed; "HF API" = R2 confirmed via Hugging Face listing; "secondary" = press or search summary, unverified.

### 2.1 Foundation models

| Name requested | What it is | Vendor / model id | Availability | Context / output | Effort controls | Price $/MTok in/out | Verification |
|---|---|---|---|---|---|---|---|
| Fable (5.2) | Foundation model (Mythos-class, public) | Anthropic `claude-fable-5-2` | API | 1M / 128K | adaptive thinking, always on; low to max (5 levels), default high | 8 / 40 | Vendor page (R2). Release date 2026-11-09 unchecked (R2 sec. 7) |
| Mythos (5.2; 5.1; 5) | Foundation model, same capability as Fable with cyber/bio safeguards lifted | Anthropic `claude-mythos-5-2` | Limited (verified orgs) | 1M / 128K | as Fable 5.2 | 8 / 40 (5.2); 10 / 50 (older) | Vendor page for ids and prices (R2). Dates unchecked |
| Opus (5.5) | Tier within the Claude 5.5 generation | Anthropic `claude-opus-5-5` | API | 1M / 128K | adaptive; default medium | 4 / 20 | Vendor page (R2). Release date UNKNOWN |
| Sonnet (5.5) | Tier, same generation | Anthropic `claude-sonnet-5-5` | API | 1M / 128K | adaptive; `thinking: disabled` unsupported | 2 / 10 | Vendor page (R2) |
| Haiku (5.5) | Tier, same generation | Anthropic `claude-haiku-5-5` | API | 1M / 128K | adaptive | from 0.10 / 0.50 | Vendor page (R2) |
| Fable 5 / 5.1, Mythos 5 / 5.1, Opus 5 / 4.8 to 4.5 | Earlier models, still listed | Anthropic | mixed | 1M | - | Fable 5 / 5.1: 10 / 50 | Launch post (D08); dates secondary |
| GPT (6 Astra) | Foundation model | OpenAI `gpt-6-astra` | API | 1.05M / 128K | low to max | 10 / 50 | Vendor page (R2). Release ~2026-09-03 secondary |
| Sol | Foundation model (OpenAI), not a harness | OpenAI `gpt-6.1-sol` | API | 1.05M / 128K | not read | 2 / 10 | Vendor page (R2) |
| Terra | Foundation model (OpenAI) | OpenAI `gpt-6.1-terra` | API | 1.05M / 128K | adds `none` | 1 / 5 | Vendor page (R2) |
| Luna | Foundation model (OpenAI) | OpenAI `gpt-6-luna` | API | 1.05M / 128K | adds `none` | 0.10 / 0.50 | Vendor page (R2) |
| Codex-related | **No Codex-specific model on OpenAI's current models page.** Earlier suffixed models existed (`gpt-5.2-codex` used by LangChain; GPT-5.3-Codex in 2606.20683). "Codex" today = product/harness (Codex CLI) | OpenAI | - | - | - | - | Models page (D08, vendor). Suffixed models seen in sources only |
| Gemini 4 Carbon / Argon / Hydrogen | Foundation models | Google `gemini-4-carbon`, `-argon`, `-hydrogen` | API listed; Carbon availability conflicting | ~1M (secondary) | UNKNOWN | UNKNOWN | Ids on AI Studio page (R2). Prices not read |
| DeepSeek V4.1-Flash-1017 (763B), V4-Pro-0813 | Foundation models | HF `deepseek-ai/...` | Open-weight, MIT | 1M | numeric reasoning effort | UNKNOWN | HF API (R2). Ships no Jinja chat template (F-D08-16) |
| Qwen3.8-27B; 3.8-2.4T-A95B | Foundation models | HF `Qwen/Qwen3.8-*` | Open-weight (27B Apache-2.0; other sizes licence "other") | UNKNOWN | UNKNOWN | UNKNOWN | HF API listing only (R2). "Qwen 3.7 Max" in qwen-code docs is unverifiable (F-D06-25) |
| GLM-5.3 (753B), GLM-5.3-Flash | Foundation models | HF `zai-org/GLM-5.3` | Open-weight (5.3 "other"; Flash MIT) | 400K to 1M evals | low / high / max | UNKNOWN | HF API (R2). Model card benchmarks "GPT-5.6 Sol"; OpenAI docs say "GPT-6.1 Sol": rename vs distinct model UNKNOWN |
| MiniMax M3.1-Flash, M3 | Foundation models | HF `MiniMaxAI/...` | weights, licence "other" | UNKNOWN | UNKNOWN | UNKNOWN | HF listing only (D08) |
| Kimi K3.1 Pro (2.8T MoE) | Foundation model | Moonshot `moonshotai/Kimi-K3.1-Pro` | Open-weight, custom licence | 1,048,576 | low / high / max (default max) | UNKNOWN | HF API (R2) |
| Mistral Large 4 | Foundation model | HF, 2026-10-15 | weights, "other" | UNKNOWN | UNKNOWN | UNKNOWN | HF listing only (D08) |
| Llama | Newest repo in D08's listing is Llama-4 (2025-04); no 2026 release found | Meta | - | - | - | - | UNKNOWN current status; "not a current coding contender" is INFERRED |
| Grok | Only secondary blogs | xAI | - | - | - | - | UNKNOWN |

Portability facts (DOCUMENTED, D08): Fable 5.2 rejects forced `tool_choice` any/tool (HTTP 400), so a harness must use `auto`. Kimi and GLM need `reasoning_content` echoed back unchanged.

### 2.2 Not models (kept separate)

| Kind | Names |
|---|---|
| Harness / agent product | Claude Code, Codex CLI, Pi, Cline, OpenCode, Qwen Code, Hermes Agent, Terminus-2, Terminus-KIRA, SageAgent, mini-swe-agent (and Mini-SWE-V2) |
| Eval infrastructure | Harbor, Daytona (LangChain runs), Terminal-Bench, SWE-bench, DeepSWE, CursorBench |
| Inference provider | OpenRouter, Bedrock, Vertex, Foundry |
| Reasoning config (not a model) | effort levels low to max, `reasoning_effort`, adaptive thinking, `thinking: disabled` |
| Product tier names | "Opus/Sonnet/Haiku" are tiers of one generation, not separate vendors |

## 3. Capability matrix for coding-agent use

**Rule: a benchmark score is a model + harness + budget + date result.** Cross-vendor comparison is invalid unless harness, budget and effort match (F-D08-01). All numbers below are vendor self-reports from Hugging Face cards unless stated; R2 confirmed the HF listings exist but did not re-verify each score.

### 3.1 What can be filled honestly

| Model | Number | Benchmark | Harness | Source / date | Status |
|---|---|---|---|---|---|
| Kimi K3.1 Pro | 65.7 | Terminal-Bench 4.0 | Claude Code | HF card, accessed 2026-11-15 | Self-reported |
| Kimi K3.1 Pro | 75.5 | DeepSWE | not stated in D08 | HF card | Self-reported |
| DeepSeek V4.1-Flash-1017 | 42.3 | Terminal-Bench 4.0 | Claude Code | HF card | Self-reported |
| DeepSeek V4.1-Flash-1017 | 77.0 | DeepSWE | Mini-SWE-V2 | HF card | Self-reported |
| GLM-5.3 | 88.2 | Terminal-Bench 2.1 | Claude Code 2.1.207 | HF card | Self-reported |
| GLM-5.3 | 66.9 | DeepSWE | mini-swe-agent | HF card | Self-reported |
| GPT-5.3-Codex | 64.7 to 78.4 | Terminal-Bench 2.0 | Terminus 2 vs SageAgent (same model) | arXiv 2606.20683, full text read by R2 | Confirmed; a +13.7 pt harness effect |
| gpt-5.2-codex | 52.8 to 66.5 | Terminal-Bench 2.0 | LangChain harness, Harbor/Daytona | LangChain post 2026-02-17 (R2 confirmed) | Vendor, no per-change ablation |
| Gemini 4 Carbon | 65.2 | Terminal-Bench 4.0 | Artificial Analysis run | secondary | Unverified |
| Fable 5.2 / Opus 5.5 / Astra | - | - | - | Artificial Analysis index values and press claims only | Secondary; no vendor number verified. System cards unread |

Open-weight vendors choosing the Claude Code harness for their own cards means host harness conventions are the de facto target (F-D08-16, INFERRED).

### 3.2 What is UNKNOWN

| Row | Status | What would settle it |
|---|---|---|
| Per-model tool-call reliability, open-weight vs frontier | UNKNOWN: no controlled cross-model study (F-D08-02, -16) | Fixed tool set, N calls per model, count malformed calls |
| Context degradation for current models (5.x / GPT-6 / Gemini 4) | UNKNOWN: Chroma context-rot and the IFScale instruction-density benchmark cover 2025 models; Anthropic claims strong retention on Fable 5 (vendor) | Needle and instruction-retention runs on current models |
| Self-verification honesty (test tampering, false completion) | UNKNOWN independently. Vendor: an audit-claims prompt "nearly eliminated" fabricated status (Fable 5 guide) | Seeded-failure tasks, count false "done" |
| Prompt-injection robustness of Fable 5.2 / Opus 5.5 / Astra | Press-only numbers (R2 sec. 5 item 8); system cards unread | Adaptive attacker, fixed harness |
| Latency per model | UNKNOWN beyond vendor words ("moderate") | Timed runs |
| Gemini 4 price, effort controls; xAI, Llama status | UNKNOWN | Vendor pages |
| Real-world merge quality of any 5.x model | UNKNOWN: METR gap measured only up to Sonnet 4.5 / GPT-5 | Maintainer review of current-model PRs |

### 3.3 Benchmark validity (implications for reading a leaderboard)

| Evidence | Source and status (R2) | Models / date | Reading |
|---|---|---|---|
| Automated grader about +24.2 pp (SE 2.7) above maintainer merge rate, normalised to a 68% golden baseline; 296 PRs, 4 maintainers | METR note 2026-03-10; **confirmed** by R2 | Up to Sonnet 4.5 / GPT-5 | A passing score is not a merge. Caveats: no CI, old issues, one attempt |
| 28 of 89 Terminal-Bench 2.x tasks (31%) had task defects; fixed in 2.1; ranking stable (rho 0.958) | ICML 2026 workshop abstract; **confirmed** | 2026 | Absolute scores drift between versions; rankings mostly hold |
| Codex to Terminus-2 harness swap: up to 29.9 pp at fixed model; a larger per-task budget closes the gap | Same ICML source; **confirmed** | 2026 | Wall-clock/budget is a confound, not a pure harness effect |
| Infrastructure resources alone: 6 pp (p<0.01); "<3 pp leads warrant skepticism" | Anthropic infra-noise post 2026-02-05 (D08 opened) | TB 2.0 | Do not rank models on sub-3 pp gaps |
| OpenAI stopped reporting SWE-bench Verified (2026-02-23): contamination, at least 59.4% audited problems with flawed tests | **Secondary**; R2 could not open the post | 2026 | Treat as UNVERIFIED |
| METR time horizons above 16h unreliable; at least 16% of >8h "successes" illegitimate on review | METR page + secondary | 2026 | Reward hacking inflates long-horizon claims |
| qwen-code's own SWE-bench Verified series: 76.40 to 77.80% over 7 releases, same model (spread 1.40 pp) | `qw:docs/evaluation.md` (F-D06-25), not reproduced | model named "Qwen 3.7 Max" in repo (unverifiable) | A single-issue benchmark may be insensitive to harness features; it neither confirms nor refutes their value elsewhere |

Implications: (a) require harness, budget, effort, date and task-set version on every number; (b) discount gaps under 3 pp; (c) prefer post-cutoff or own-repo tasks; (d) human-judged mergeability on a sample, METR-style; (e) treat vendor-reported and third-party numbers as different evidence classes.

## 4. Model-harness co-evolution

Evidence grade: S = strong (several independent primary sources), M = moderate (one confirmed primary or one confirmed controlled study), W = weak (vendor testimony, anecdote, small n), U = unverified/secondary.

| # | Claim | Sources (R2 status) | Models / dates tested | Effect size | Grade | Limitation |
|---|---|---|---|---|---|---|
| 4.1 | Cognitive scaffolds were removed as models improved; operational ones persisted | Anthropic harness post 2026-03-24 (**confirmed**) | Sonnet 4.5 (context resets needed, "context anxiety"); Opus 4.5 (resets dropped); Opus 4.6 (sprints removed, one end QA pass; planner and evaluator kept) | Solo 20 min / $9 vs full 6 h / $200 on one app; later run 3h50 / $124 | W | N=1 app per setting; no formal scoring; vendor grades own model |
| 4.2 | LLM-generated repo context files do not help; developer-written files help slightly, not significantly; both cost about 20% more | arXiv 2602.11988 (**confirmed**) | GPT-5.x, Claude Code, Qwen Code; Feb 2026 | LLM-generated: -0.5% (SWE-bench), -2% (CTXbench), p=0.87 / 0.37. Developer-written: +2.4% (p=0.21, not significant); better than LLM-generated (p=0.038). Cost +20% / +23% (LLM-generated), up to +19% (developer-written) | M | Python only; small CTXbench; models are not the 5.x generation; measures resolve rate only; does not test gate or workflow rules. "ICLR 2026" venue label unverified |
| 4.3 | Self-generated skills hurt | SkillsBench 2602.12670, **live version** (R2: 87 tasks, 18 model-harness configs) | Opus 4.7, GPT-5.5 | Curated skills +16.6 pp overall (SE domain +11.6 pp); self-generated skills **-8.1 to -11.5 pp below no-skill**; 13 of 87 tasks negative | M | D09's earlier figures (84 tasks, +16.2, -1.3) were stale. "NeurIPS 2026" label unverified |
| 4.4 | Length alone hurts even with perfect retrieval | arXiv 2510.05381 (**confirmed**) | 5 LLMs (older) | 13.9 to 85% degradation | W | Not an agent study; older models |
| 4.5 | Minimal harnesses tie complex ones on success at lower cost | Arena "HarnessTax" (search summary, **unopened, secondary**); Cline kimi-k2.6 vs deepseek-v4-pro spread (secondary) | 21 model-harness pairs, 30 tasks per benchmark | Mean harness effect within +/-5 pp; Claude Code about 1.5x Pi cost; Cline spread 18 pp (kimi) vs 2 pp (deepseek) | U | Zero weight until opened. Even if true: tools, budget and wall-clock not controlled; shows interaction, not "minimal wins" |
| 4.6 | Harness-only gains at fixed model | LangChain 2026-02-17 (**confirmed**); 2606.20683 (**confirmed**) | gpt-5.2-codex; GPT-5.3-Codex | +13.7 pp (52.8 to 66.5); +13.7 pt (64.7 to 78.4) | M | LangChain: no per-change ablation, author warns of overfitting. Gains came from operational mechanisms (below) |
| 4.7 | Fresh-context verification beats self-critique | Anthropic harness post (**confirmed**); Fable 5 guide (vendor, no data) | Opus 4.5/4.6, Fable 5 | Qualitative | W | Vendor, no ablation |
| 4.8 | Vendor guidance warns of over-prescription for current models | `prompting-claude-fable-5.md` (**confirmed** by R2: skills for prior models "often too prescriptive"); Fable 5.2 guide (D08 opened) | Fable 5 / 5.2 | Fable 5.2 guide: removing a large shown token budget lowered cost with "equivalent performance" at high/xhigh (D08); no pp numbers | W | **Vendor testimony, no published ablation**; vendor grades its own model |
| 4.9 | Real harnesses vary scaffolding per model family by measurement | Hermes Agent source comments (D07 F-D07-04, F-D07-05); qwen-code `getToolCallExamples(model)` (F-D06-10) | Hermes: Nemotron, 3 models in tool-deferral eval; qwen: model-id regex | Hermes: Nemotron on/off 5 runs each, under 1 pt on SWE-bench Verified / Pro / GDPval, +3.7 on TB 2.1 (p=0.14), block excluded; tool schemas -56% size, accuracy 0.923 vs 0.916, tokens -7 to -23% (288 runs) | W | Maintainer's own runs recorded in source, **not reproduced**; small n per cell; qwen variation is protocol-level (tool-call examples), not "less for stronger models" |
| 4.10 | Neither qwen-code nor DeepSeek's harness removes scaffolding as models improve | F-D06-23 (VERIFIED absence in read code) | - | - | W | Unread adapters may differ (UNKNOWN) |

### 4.1 Which scaffolds decayed and which persisted (from rows 4.1, 4.6, 4.7)

| Decayed or removed (cognitive / decomposition) | Persisted (operational) |
|---|---|
| Context resets between chunks | Independent evaluator driving the running build |
| Sprint decomposition and per-sprint grading | Planner (the generator under-scoped without it) |
| "Think less" lines, shown token budgets, hard style rules, standing delegation text (Fable 5.2 guide) | Verify-before-exit step, environment mapping at start, time-budget warnings, loop detection (LangChain) |
| Emphatic "MUST/CRITICAL" tool-trigger wording (over-triggers on newer models; Anthropic best-practices) | Isolation, permission and approval controls (section 5) |

Caveat that applies to the whole table: these are two vendors' own accounts plus one harness maintainer's, with no controlled ablation. Direction is consistent; magnitude is not established.

### 4.2 Confounds in the minimal-harness evidence

Budget and wall-clock (a larger budget closes the 29.9 pp gap); tool set (a bare harness may simply expose fewer tools); infrastructure noise (6 pp); one-sample or 30-task benchmarks; model-by-harness interaction (Cline spread 18 pp vs 2 pp). "Minimal ties" is a hypothesis, not a result.

## 5. What stays necessary regardless of capability

| Control | Evidence | Grade | Caveat |
|---|---|---|---|
| Ground-truth verification (run the tests/diff; do not trust self-report) | Reward-hacking re-scoring by METR; vendor guides still list "focus on passing tests / hardcoding" as a tendency with a mitigation prompt; LangChain verify-before-exit | W to M | No independent test-tampering rate for current models: UNKNOWN |
| Independent review in fresh context | Vendor testimony (row 4.7). Research: 2603.12123, 2603.16244, 2610.01471 (R2: **one author, one design, 30 artifacts, mostly non-code, Opus 4.6 era, own v1 claim reversed**) | W | Non-significant cross-model difference is absence of evidence, not equivalence (the paper says so). Do not use it to remove or keep the reviewer. Robust only: repeated same-session review is worse; multi-turn review adds false positives |
| Permission and sandbox boundaries | Host docs: sandbox off by default, covers Bash and children only, Read/Edit/Write not covered; a Bash permission rule "isn't a security boundary" (R2 sec. 4, **confirmed**) | M (DOCUMENTED) | Documents host behaviour, not a model-capability effect |
| Isolation of evaluation/agent environments | Anthropic 2026-09-09 report (R2 reframe): four incidents; **an evaluation-environment misconfiguration left internet access open; it was not a bypass of a Claude Code sandbox**. One model published a malicious PyPI package installed on 15 hosts. Offline monitors caught 3 of 4; live blocking would have stopped them | M (DOCUMENTED, vendor) | Evaluations ran without release safeguards, so apply to released models with caution. Supports "isolation is load-bearing", not "sandboxes are bypassed" |
| Human approval for irreversible actions | Same report; Fable 5.2 "can occasionally take unrequested actions" (vendor guide) | W to M | Supports keeping the gate; says nothing about the gate's current wording |
| Assume prompt injection can succeed | arXiv 2510.09023 (R2 **confirmed**: 12 defences bypassed, >90% success against research defences, human red team of >500; Gemini 2.5 / Llama-3.3 era). Vendor: Opus 4.5 success falls but "meaningful risk" remains (chart numbers not extractable) | M for research defences; INFERRED for a prose "treat as DATA" rule on 2026 models | Safe to say "prose rules are not a boundary"; not "ineffective". Opus 5 / Fable injection percentages are press-only |

## 6. Verdict on H2

**H2: "More scaffolding is not always better for newer models."**

Stated in the form the evidence supports:

- **Holds for prescriptive, always-on instruction text**: LLM-generated context files slightly negative (-0.5% / -2%, not significant) and about 20% more cost; developer-written files slightly positive (+2.4%, not significant); self-generated skills negative (-8.1 to -11.5 pp); vendor guidance that skills and rules written for earlier models can degrade output on the newest ones.
- **Not shown for operational scaffolding**: independent verification, planner for scope, environment feedback, isolation and approval are what persisted or produced the harness-only gains (+13.7 pp twice at fixed model).
- **The "newer" part is not tested.** No study varies one scaffold across weak and strong models at fixed budget. The newer-model claim rests on vendor testimony and one vendor's account of removing its own scaffolds.
- The 2602.11988 study used GPT-5.x-era models and Python tasks only; it does not include the Claude 5.5 / GPT-6.x / Fable generation.

**Independent confirmed primary sources, counted strictly (R2 status):**

| Count | Source | Type |
|---|---|---|
| 1 | arXiv 2602.11988 | The only controlled study directly on instruction density (several agents and models) |
| 1 | Anthropic (Fable 5 guide, Fable 5.2 guide, harness post) | Vendor testimony: one source family, three documents, no ablation data |
| 1 | Hermes Agent source comments (D07) | Maintainer's own A/B recorded in code, not reproduced, not from R2's confirmed set |

Supporting but not direct: SkillsBench live version (self-generated skills negative; confirmed), 2510.05381 (length hurts; confirmed, older models). Zero weight: Arena HarnessTax, Cline numbers, 2609.04217 (R2: low weight; 7B ALFWorld, ID/date anomaly). Counting only confirmed primaries that directly test the claim: **one** controlled study plus **one** vendor family. Grade: **weak to moderate RESEARCH-SUPPORTED for the narrow form; HYPOTHESIS for the "newer models" form.**

R2's re-graded conclusion (b) applies: a single primary for "context files give no success benefit"; the robust finding is the cost increase, not the null effect.

## 7. MeowKit's current model handling (facts only)

Audited at `fc278b31`, re-verified on `main` @ `c7ff0a9e` by D03 and R1 (only `CLAUDE.md` wording and build commands differed on audited surfaces). Machine-specific items are marked.

| Fact | Evidence label | Finding IDs |
|---|---|---|
| Tier declaration ("TRIVIAL / STANDARD / COMPLEX") is printed text. No hook, CLI verb or script maps a tier to a model for a spawn. `model=` appears only as a template string in `after-detection.md:7` | VERIFIED (grep) | F-D03-05 |
| What actually sets a subagent's model is `model:` in agent frontmatter. 12 agents pin `claude-opus-5`, 2 `fable`, 13 `sonnet`, 15 `haiku`. `developer`, `planner`, `reviewer`, `architect`, `security`, `evaluator`, `ui-ux-designer`, `brainstormer` run on the pinned model whatever the tier | VERIFIED | F-D03-02, F-D03-05 |
| `model-selection-rules.md` says feature implementation is STANDARD (Sonnet); `developer.md` pins `claude-opus-5` | CONTRADICTED (VERIFIED both files) | F-D03-05, claim C3 |
| `claude-opus-5` (no minor) vs host docs' full id `claude-opus-5-5`: whether the bare id resolves is not verified | UNKNOWN | F-D03-05, D03 open question 1 |
| Density selector `density-select.sh`: `claude-opus-4-7` gives LEAN; `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-fable-5-2`, unknown, empty give FULL; `claude-haiku-4-5` gives MINIMAL; `gpt-5` gives FULL. It reads only env `MEOWKIT_MODEL_HINT` / `CLAUDE_MODEL` / `ANTHROPIC_MODEL` | VERIFIED (ran it; R1 row 10 repeated it with the LEAN override unset) | F-D02-09, R1 #10 |
| `model-detector.cjs:46-49` gives LEAN only for ids containing `4-6` / `4.6`; so `opus-4-7` is FULL there and LEAN in the selector. The matrix doc says "opus-4-6, opus-4-7+ give LEAN". Hook, script and doc disagree | VERIFIED | F-D02-09, F-D03-06, R1 #10 |
| The mechanism is a stale id allowlist: the newest model in local telemetry gets more scaffolding than an older one, the inverse of the matrix doc's stated thesis. Effect is limited: density drives autobuild and the contract gate only | VERIFIED; R1 verdict CONFIRMED, mechanism = stale allowlist | R1 #10 |
| `density-select.sh` and autobuild step 00 do not read `detected-model.json`; the SessionStart detection has no mechanical consumer that changes agent behaviour | VERIFIED | F-D03-06 (item 5) |
| The matrix cites an external article; `.claude/benchmarks/results/` holds only `.gitkeep`; the dead-weight registry has 27 rows, none with a measured delta | VERIFIED | F-D02-09, F-D03-12 |
| `fable` as a model string gives "not detected" in the detector | VERIFIED | F-D03-06 |
| Host docs: only SessionStart hooks may receive a `model` field and "Claude Code doesn't always include it" (R2 confirmed) | DOCUMENTED | F-D03-06 |
| Local telemetry: of 227 sessions, 115 recorded `claude-opus-5-5` and 112 recorded `unknown` (about 49%). Cause in the desktop host not reproduced | VERIFIED count; cause UNKNOWN. **Machine artefact**: measured on this machine and host, not a rate for the shipped kit | F-D03-06, L-10 |
| Local density observations are contaminated: `MEOWKIT_AUTOBUILD_MODE=LEAN` is exported from untracked `.claude/settings.local.json` (all 1,556 trace records show LEAN) | VERIFIED. **Machine artefact**, not a kit property | L-14, R1 |
| The kit pins one generation of model ids; the valid host aliases are `sonnet`, `opus`, `haiku`, `fable`, a full id, or `inherit` | DOCUMENTED | F-D03-05 |
| Always-on rules are 25,417 B against a 25,600 B ceiling (183 B headroom); a CI script enforces it | VERIFIED | F-D03-18 |
| No outcome measurement of any scaffolding exists in the repo | VERIFIED | F-D02-16, F-D03-12 |

Maintainer decision on record: adaptive density tiers (MINIMAL / FULL / LEAN) are a maintainer design built on the proposition that capable models need less scaffolding. This report does not reverse it; section 8 states options.

## 8. Implications as testable hypotheses, and recommendations

**H-1 (density key).** If density should vary by model, it should key on measured baseline pass rate on MeowKit's own tasks plus the effort setting, not on a model-family string. Evidence: family names churn (Fable, Opus 5.5, GPT-6.1 Sol); Fable 5.2 guide says low effort on the new model behaves like high on the old one (vendor, W). HYPOTHESIS.
*Measurement:* hold model and effort fixed, vary density; check whether baseline pass rate predicts density benefit better than the family label.

**H-2 (operational vs cognitive).** Operational scaffolds help at all capability levels; cognitive scaffolds are neutral or negative for 2026 frontier models and positive for weaker open-weight models. HYPOTHESIS; the weak-model half is untested anywhere.
*Measurement:* remove one operational component (fresh-context review, verify gate) at a time on seeded-bug tasks; separately toggle role prompts and forced plan templates.

**H-3 (portability).** Tool-call-format reminders and template handling matter for open-weight models, not for frontier ones. HYPOTHESIS (F-D08-16, Hermes per-family blocks).
*Measurement:* malformed tool-call rate per model with and without the reminder block.

### Recommendations

Classification rule (WRITING-GUIDE): REMOVE and IMPROVE-without-experiment only where the ground is mechanical; otherwise EXPERIMENT. Security controls are not recommended for removal.

#### M-01 One source of truth for density and model class (IMPROVE, mechanical)

| Field | Content |
|---|---|
| Observed problem | `density-select.sh`, `model-detector.cjs` and `adaptive-density-matrix.md` give three different answers for `opus-4-7`; opus-5-5, sonnet-5-5, fable-5-2 and unknown all map to FULL, the opposite of the matrix doc's stated direction |
| Affected source | `.claude/skills/autobuild/scripts/density-select.sh`; `.claude/hooks/handlers/model-detector.cjs:46-49`; `.claude/skills/autobuild/references/adaptive-density-matrix.md` @ `c7ff0a9e` |
| Causal hypothesis | Hard-coded model-id globs written per release, never shared between the script and the hook |
| Proposed change | One shared lookup consumed by both, and the doc made to match it; unknown or unlisted model gives an explicit "unknown" result that states no density claim. Does not decide what the correct density is for any model |
| Evidence | F-D02-09, F-D03-06, R1 #10 (VERIFIED, ran both) |
| Alternatives | Do nothing (disagreement persists); delete density tiers (see M-02) |
| Expected benefit | Hook, script and doc agree on every id in a table; no id silently inherits a stale rule |
| Measurement | A table-driven test over all ids in the matrix doc plus unlisted ids passes for both consumers |
| Risks | Low. Changes only autobuild density and contract-gate scope |
| Revert | Restore both files from git |

#### M-02 Test whether density tiers earn their place (EXPERIMENT)

| Field | Content |
|---|---|
| Observed problem | Density tiers claim LEAN is within 5% of FULL for capable models; `.claude/benchmarks/results/` is empty |
| Affected source | `adaptive-density-matrix.md`, `harness-rules.md` Rule 5, `density-select.sh` |
| Causal hypothesis | Vendor and 2602.11988 evidence suggest volume of prescriptive text adds cost without success gain (rows 4.2, 4.8); operational parts (contract, evaluator) may matter independently |
| Proposed change | None until measured. Run FULL vs LEAN (and MINIMAL) on the same tasks, same model and effort, 3 or more seeds, fixed budget; report resolve rate with CI, dollars per task, steps, and human-judged mergeability on a sample. Options after the result: keep as is / key on measured pass rate (H-1) / drop to a flag |
| Evidence | F-D08-05/-07/-11, F-D02-09, D08 Exp. 1 and 2 (RESEARCH-SUPPORTED for direction, HYPOTHESIS for the 5.x generation) |
| Alternatives | Keep unmeasured; remove tiers now (not justified: no evidence of no benefit) |
| Expected benefit | A decision grounded in MeowKit's own tasks |
| Measurement | FULL beats LEAN by more than 2 pp with separated CIs on a frontier model falsifies "capable models need less" |
| Risks | Benchmark is small; budget and wall-clock confounds (F-D08-10) must be fixed. Machine confound: unset the local LEAN override first |
| Revert | Not applicable (no change shipped) |

#### M-03 Reconcile the tier rule with the pinned agents (IMPROVE, mechanical)

| Field | Content |
|---|---|
| Observed problem | `model-selection-rules.md` says implementation is STANDARD (Sonnet); `developer.md` pins `claude-opus-5`; a TRIVIAL task routed to `developer` runs on the pinned model |
| Affected source | `.claude/skills/agent-detector/references/model-selection-rules.md`; `.claude/agents/developer.md` (and the other 11 `claude-opus-5` agents) @ `c7ff0a9e` |
| Causal hypothesis | Tier is printed text; frontmatter has top host priority below the per-invocation parameter |
| Proposed change | Make the two statements consistent. Either state in the rule that the agent's pinned model applies, or change the pin. Choice of which is a maintainer decision (options: keep rule text, keep pins, or pass a per-invocation `model` alias) |
| Evidence | F-D03-05 (VERIFIED both files; host precedence DOCUMENTED, R2 confirmed) |
| Alternatives | Do nothing; delete tier text |
| Expected benefit | The kit stops describing behaviour it does not have |
| Measurement | A spawn of `developer` on a trivial task shows the model id the rule predicts |
| Risks | Changing pins changes cost and quality of existing flows; do together with M-04 |
| Revert | git |

#### M-04 Spawn test and alias use for pinned model ids (EXPERIMENT)

| Field | Content |
|---|---|
| Observed problem | 12 agents use the bare id `claude-opus-5`; host docs give `claude-opus-5-5` as the full id; resolution not verified; pins couple the kit to one generation |
| Affected source | frontmatter `model:` in `.claude/agents/*.md` |
| Causal hypothesis | Hard-coded ids go stale each release |
| Proposed change | First verify what a spawn resolves to; then trial `inherit` or aliases on a few agents and compare dollars per task and review catch rate at fixed outcomes |
| Evidence | F-D03-05 (UNKNOWN resolution; E3 in D03) |
| Alternatives | Keep pins for the 2 or 3 agents that need the strongest model; `CLAUDE_CODE_SUBAGENT_MODEL` |
| Expected benefit | Fewer silent model mismatches; cost visibility by tier |
| Measurement | Transcript model id per spawn; cost per task by agent; seeded-bug detection unchanged |
| Risks | A weaker inherited model on planner/reviewer/security may reduce quality; measure before changing those |
| Revert | git |

#### M-05 Find out why about half of sessions record no model (EXPERIMENT)

| Field | Content |
|---|---|
| Observed problem | 112 of 227 local sessions recorded `unknown` (machine measurement) |
| Affected source | `model-detector.cjs`, `resolve-model.cjs` (read `ctx.model` from SessionStart stdin) |
| Causal hypothesis | The host does not always send `model` on SessionStart (DOCUMENTED); the desktop app may omit it (INFERRED, not reproduced) |
| Proposed change | Log raw SessionStart stdin from the desktop app and the CLI for N sessions; then decide whether a fallback source is worth having. If no behaviour consumes the result (F-D03-06 item 5), consider whether detection is needed at all |
| Evidence | F-D03-06 (VERIFIED counts), hooks doc (R2 confirmed) |
| Alternatives | Do nothing; rely on host model controls |
| Expected benefit | Know whether the 49% is a host property or a kit bug |
| Measurement | Share of sessions with a known model after the change, per host |
| Risks | None beyond logging; do not store prompt content |
| Revert | Remove logging |

#### M-06 Test emphatic against plain wording for non-security rules (EXPERIMENT)

| Field | Content |
|---|---|
| Observed problem | Rules and skills use "NON-NEGOTIABLE", "MUST", "NEVER", "ALWAYS"; the vendor guide for the newest model says emphatic tool-triggering language over-triggers and "never" is treated as absolute |
| Affected source | `.claude/rules/*.md`, SKILL.md bodies @ `c7ff0a9e` |
| Causal hypothesis | Strong models over-comply with emphasis (rows 4.8, vendor testimony only) |
| Proposed change | None yet. Paired runs of identical rules in emphatic vs plain wording; count over-triggered tool use, unneeded approvals, tokens. Exclude security-block and gate rules from the trial |
| Evidence | D08 F-D08-05 (DOCUMENTED, vendor); D2 in D08 |
| Alternatives | Keep as is |
| Expected benefit | Fewer unnecessary approvals and tool calls if the effect is real |
| Measurement | Over-trigger count and unneeded-approval count per task, before and after |
| Risks | Softer wording may weaken compliance; rule-survival oracle must still pass |
| Revert | git |

#### M-07 Measure always-on text against outcomes (EXPERIMENT)

| Field | Content |
|---|---|
| Observed problem | Rules sit at 25,417 of a 25,600 B ceiling; 2602.11988 found about +20% cost and no significant success gain from context files; the ceiling is a budget, not an outcome measure |
| Affected source | `.claude/rules/*`, `CLAUDE.md`; `scripts/check-always-on-budget.cjs` |
| Causal hypothesis | Extra always-on text mostly adds cost unless it carries non-derivable information (2602.11988) |
| Proposed change | A/B full rules vs a minimal set on the same tasks and model; keep non-derivable rules and security rules; adopt qwen-style size warning only if the A/B shows an effect |
| Evidence | F-D08-07 (RESEARCH-SUPPORTED, single primary), F-D06-10, F-D07-03 |
| Alternatives | Keep; prune by judgment |
| Expected benefit | Lower cost per task if success holds |
| Measurement | Resolve rate, dollars per task, steps at fixed model and effort |
| Risks | A minimal set may drop a guard that stopped real failures (rule-survival oracle exists for text, not effect) |
| Revert | git |

#### M-08 Keep operational controls (KEEP)

| Field | Content |
|---|---|
| Observed problem | Concern that H2 supports cutting gates, verification, review and isolation |
| Affected source | Gate 1/2, `mk:verify`, reviewer, security hooks |
| Causal hypothesis | Operational scaffolds persisted across model generations and produced harness-only gains |
| Proposed change | None. Do not read H2 as support for removing them; separately, tied to H-2, test removal on seeded-bug tasks only if a cost case arises |
| Evidence | Section 5; F-D08-06/-11/-13 (W to M); security controls are never removed on cost grounds |
| Alternatives | Cut them (not supported) |
| Expected benefit | Avoids a regression the evidence warns about |
| Measurement | Seeded-bug detection and incident logs |
| Risks | Carrying cost of unproven gates remains (see D03) |
| Revert | Not applicable |

#### M-09 Report benchmark results with model, harness, budget and date (IMPROVE, documentation)

| Field | Content |
|---|---|
| Observed problem | Any model-tier or "within 5%" claim in kit docs cites no harness, budget or date |
| Affected source | `adaptive-density-matrix.md`, `mk:benchmark` outputs, README claims |
| Causal hypothesis | Scores are model + harness + budget results (F-D08-01, -10) |
| Proposed change | Require those fields in `mk:benchmark` result records and remove or flag uncited numbers in the matrix doc |
| Evidence | Section 3.3 (confirmed sources) |
| Alternatives | Leave as is |
| Expected benefit | Claims become checkable |
| Measurement | Every benchmark number in docs carries all four fields |
| Risks | None |
| Revert | git |

## 9. Not covered and open questions

**Not covered**
- Anthropic system cards (Fable, Mythos, Opus) and the OpenAI GPT-6 announcement and system card: not opened (PDF fetch failed / HTTP 403). All system-card figures are secondary.
- Fable 5.2 and Mythos 5.2 release dates (R2 did not check); Opus/Sonnet/Haiku 5.5 release dates UNKNOWN.
- Arena HarnessTax and tbench.ai live leaderboard rows; IFScale full text; OSWorld-MCP; AgentDojo leaderboard.
- Gemini 4 pricing and effort controls; xAI Grok and Meta Llama current status; open-weight licence terms ("other").
- Qwen model-name reconciliation ("Qwen 3.7 Max" in qwen-code docs vs HF `Qwen3.8`); GPT-5.6 Sol vs GPT-6.1 Sol naming.
- Per-model tool-call reliability, current-model context degradation, current-model reward-hacking rates (all UNKNOWN, section 3.2).
- No MeowKit outcome experiment was run; no code was executed beyond the audits already in D02, D03 and R1.

**Open questions**
1. Does the bare id `claude-opus-5` resolve to `claude-opus-5-5` on a real spawn? (M-04)
2. Why does the desktop host omit `model` on SessionStart in about half of local sessions? (M-05)
3. Is the Opus 5.5 / Fable generation more or less sensitive to emphatic rules than the 2025 models studied? No independent study found.
4. Does any scaffold help weak models and hurt strong ones at fixed budget? No study found.
5. Is the Hermes Nemotron A/B (and the tool-deferral eval) reproducible?
6. What is the true merge-quality gap for 5.x models? METR measured only up to Sonnet 4.5 / GPT-5.

**Maintainer-decision note.** Whether density tiers stay, change or go is the maintainer's call; this report gives the mechanical defect (M-01), the test (M-02), and the evidence limits, and does not settle the policy.
