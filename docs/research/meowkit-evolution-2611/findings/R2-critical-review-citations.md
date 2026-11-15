# R2 — Independent citation audit (D08, D09, D10, D11, D12 + DOCUMENTED claims in D01/D03/D05)

Auditor: R2. Date 2026-11-15. Method: every arXiv ID fetched from `arxiv.org/abs/<id>` (raw HTML, `citation_*` meta + submission history); full text from `arxiv.org/html/<id>` where a number needed checking; vendor docs fetched as raw markdown (`code.claude.com/docs/en/*.md`, `platform.claude.com/.../overview.md`), NVD JSON API, Anthropic/Nx/METR/Snyk/LangChain/Cognition/ICML pages via curl then text-extracted. No summarising fetch tool used for any CONFIRMED verdict. Scratch: session scratchpad only. Prompt-injection observation: none of the fetched pages addressed the agent.

Verdict key: C = CONFIRMED (opened, matches) / P = PARTIAL (exists, number/scope differs) / M = MISATTRIBUTED / NF = NOT FOUND / U = UNREACHABLE.

## 1. Headline result
- 47 arXiv IDs checked. 47 exist. 0 NOT FOUND, 0 fabricated. Titles/authors match how researchers used them, except: blog's 2510.10813 (a game-theory paper) is correctly NOT used for context length (D11 already fixed -> 2510.05381, C).
- Two ID/date anomalies (not one): **2609.04217** (abs page: "Submitted on 25 Jun 2026", ID prefix 2609 = Sep) and **2603.13258** (abs page: submitted 25 Feb 2026, ID prefix 2603). Researchers flagged only the first. Both fetch fine; cause unknown (hold queue possible). Authors of 2609.04217 ("Dylan David, Brennan, Murphy") are unverifiable; treat as zero-weight.
- Numbers that need correction: CAID cost multiple, SkillsBench (stale version), "null success effect" wording, scaling-study framing, "+4" lower bound. Details below.

## 2. arXiv verification table
| ID | Cited in | Claim | V | What the source says (real number) |
|---|---|---|---|---|
| 2602.11988 | D01/D03/D05/D08/D12 | context files: no success gain, ~+20% cost | C (wording) | Abs: "does not generally improve task success", cost "over 20%". Full text: LLM-generated -0.5% (SWE-bench) / -2% (CTXbench), p=0.87/0.37; developer-written **+2.4% (p=0.21, n.s.)**, better than LLM-generated (p=0.038); cost +20%/+23% (LLM), up to +19% (dev). Models: GPT-5.x, Claude Code, Qwen Code, Feb 2026. "null" is fair; "ICLR 2026" in D12 not on abs page (unverified). |
| 2512.08296 | D11 | MAS trails SAS at matched budget on SE; error amp 4.4x-17.2x | P | Exists (Kim et al., 2025-12-09). Matched tokens: yes. SWE-bench Verified: all MAS -2% to -15% vs SAS 0.522 (C), BUT that is a **20-instance subset**, 8 models (GPT-5 fam, Gemini 2.5, Sonnet 4/4.5). Overall mean delta -0.3% (CI -58.7..+77.2); finance +80.8%, PlanCraft -39..-70%. Error amp 17.2x independent -> 4.4x centralized (C). Abstract does NOT claim "MAS trails SAS"; it claims task-structure dependence. |
| 2603.21489 | D11 | CAID +4..+26 pts at 1.7-2.8x cost, worktree isolation | P | Neubig; +25.6 PaperBench / +14.7 Commit0 are best-case (MiniMax 2.5). Claude 4.5: 57.2->63.3 (+6.1), 53.1->59.1 (+6.0). Smallest gain GLM 4.7 Commit0 42.9->46.5 (**+3.6**, not 4). **Cost multiple from Table 2: 1.7x-4.3x** (Claude Commit0 1.9->8.1 = 4.3x; GLM 2.5->7.3 = 2.9x). "1.7-2.8x" understates. Soft isolation 55.5 < single 57.2 (C). Budget = fixed iteration budget per config, not matched total compute. |
| 2603.12123 | D11 | CCR F1 28.6 vs SR2 21.7 vs SR 27.1, p=0.26 | C | All four numbers in current-version abstract; SA 23.8 (p=0.057). Version history matters: v1 claimed CCR>SR (24.6%, p=0.008, still quoted in 2603.16244); revision says run-1 artefact and excludes "one SR run whose records could not be verified". Single author, 30 artifacts/150 injected errors (code+docs+scripts), Claude Opus 4.6 via Claude Code agent tool. |
| 2603.16244 | D11 | multi-turn review +62% false positives | C | D-CCR-2b: 8.47 vs 5.23 FP (+62%), F1 0.303 vs 0.376. Only one variant; Korean-language artifacts; same single author/design. |
| 2311.10054 | D11 | persona prompting no benefit | C | 162 roles, 4 LLM families, 2,410 factual QA; "does not improve". Also: persona effect "largely random", best-persona oracle helps. 2023 models; QA not coding. |
| 2607.04697 | D11 | merge conflicts 41.7% vs 19.8% | C (scope) | Exact. n=747 co-active pairs (one/repo) from AIDev-pop. Cross-agent pairs only 0.5% of co-active pairs, 122 repos. Observational PR data, not an in-harness orchestration test. |
| 2609.04217 | D11 | equal cost: MAS no better than single | C-exists, low weight | ALFWorld 0.769 vs 0.754 p=0.80, frozen **7B** backbone, prompt evolution; ID/date mismatch (2609 vs 25 Jun 2026). Not SE, not frontier. |
| 2510.05381 | D11 | length alone hurts | C | "Context Length Alone Hurts LLM Performance Despite Perfect Retrieval", 5 LLMs, degradation 13.9-85%; GPT-4o RULER up to +4% from recitation. |
| 2510.10813 | blog (D11) | mis-cited for context length | C (mis-cite confirmed) | Is "The Fragility of Strategic Thinking in LLMs" (game theory). D11 correctly rejects it. |
| 2608.21156 | D11 | survey cited by SLP article | C | "Graph Engineering in the Era of LLM Agents", cs.IR survey, 35 authors, 2026-08-21. Not validation of SLP. |
| 2610.01471 | D11/D08 | fresh review captures most gains; Jaccard 41.2%; 56.7 vs 42.7 | C (wording) | Numbers exact (Holm p=.006). Abstract: top-tier cross-model NOT significantly different from CCR "does not establish equivalence"; 2 CCR vs CCR+cross-model; capability and model-difference confounded. 900 sessions, Claude Opus 4.6 / GPT-5.4 / Gemini 2.5; artifacts all from one Opus 4.6 author; records "on request". Same single author as 2603.12123/16244. |
| 2510.09023 | D12 | 12 defences bypassed, >90% ASR | C | Exact. Spotlighting/Sandwiching >95% (static ASR as low as 1%), detectors >90% (PIGuard 71%), MELON 76% (Llama-3.3-70B), MetaSecAlign 2% static, human red-team >500 participants. Authors incl. Carlini/Nasr. Targets: research defences, Gemini 2.5 Pro / Llama-3.3 era; NOT prose "treat as DATA" in a coding agent. |
| 2601.04748 | D09 | >90% at <=20 skills, ~20% at 200 | C (scope) | Exact ("above 90%" <=20; "approximately 20%" at 200). **Only GPT-4o and GPT-4o-mini; synthetic skill libraries; single author; "preliminary experiments"; semantic confusability, not size alone, drives it.** |
| 2602.08316 | D12 | memory harm | P | SWE-ContextBench; abstract: unfiltered/incorrect context gives "limited or negative benefits". Mild; it is a benchmark of benefit, not a harm study. |
| 2505.16067 | D12 | memory harm | C | Experience-following; error propagation, misaligned replay. 2025 models. |
| 2602.21611 | D12 | structured memory +4.7 pp | C | Abs: +4.7 pp mean Pass@1 SWE-bench Verified, +6.8 on Gemini 2.5 Pro. Self-reported, 2026-02. |
| 2602.12670 | D09 | SkillsBench 84 tasks, +16.2pp, SWE +4.5, self-gen -1.3, 16-18 regress | P (stale) | Live version: **87 tasks, 18 model-harness configs, +16.6 pp (33.9->50.5)**, range +4.1..+25.7; SE domain **+11.6 pp**; 13/87 tasks negative; self-generated skills **-8.1 to -11.5 pp** below no-skill (Opus 4.7, GPT-5.5). D09's figures are from an older version (read via search snippet). "NeurIPS 2026" unverified. |
| 2604.04323 | D09 | skills fragile; Opus 4.6 TB2.0 57.7->65.5 | C | Abstract exact. 55.4 vs 51.2 forced-load found in text (Claude). |
| 2503.13657 | D11 | MAST: 1,642 traces, k=0.88, 14 modes | C | Plus 15.7/11.8 mode shares and +9.4 ChatDev CEO fix seen. 2025 frameworks. |
| 2604.02460 | D11 | SAS>=MAS at equal thinking tokens | C | Qwen3, R1-distill, Gemini 2.5; multi-hop QA; flags Gemini budget-control artefacts. |
| 2605.08478 | D11 | k-shot beats agentic | C | 216 Codeforces; self-contained algorithmic tasks, not MAS per se. |
| 2505.18286 | D11 | MAS edge shrinks; cascade +1.1-12%, -20% cost | C | Abstract exact; o3/Gemini-2.5-Pro era. |
| 2502.08788, 2311.17371 | D11 | debate vs CoT/SC | C | 5 MAD methods x 9 benchmarks x 4 models; heterogeneity helps. |
| 2603.18740 | D11 | 97% (32/33) | C | 33 CVEs/20 projects; Claude Code + CodeRabbit; template attacks fail, LLM-refined succeed. |
| 2603.26233, 2502.13069 | D11 | clarification; +74%; 69.40% | C | Abstracts exact. |
| 2511.04064, 2511.00872, 2402.00689, 2410.21819, 2508.09724 | D11 | various | C-exists | Titles match claim use; numbers not re-read. |
| 2606.20683 | D08 | GPT-5.3-Codex 64.7 (Terminus 2) -> 78.4 (SageAgent) | C | Full text lines confirm (13.7 pt). Was search-summary in D08; now verified. |
| 2606.19616, 2606.15057, 2606.10525, 2603.13258, 2507.11538, 2503.03704, 2407.12784, 2403.14720, 2410.07283, 2503.18813, 2506.08837 | D08/D12 | as cited | C-exists | AgentPoison >80% ASR/<0.1% poison/<1% benign C; CaMeL 77% vs 84% C; spotlighting >50%->2% C; MemCoder 2603.13258 has date anomaly. 2506.08837, 2606.15057/10525, 2507.11538 numbers not re-read. |

## 3. CVEs (NVD API, fetched 2026-11-15)
| CVE | NVD says | Researcher characterisation | V |
|---|---|---|---|
| CVE-2025-55284 | Claude Code <1.0.4: "overly broad allowlist of safe commands" lets file read + network send bypass prompts; needs untrusted content in context. Published 2025-08-16, CVSS 7.5 | auto-approved ping/dig/nslookup DNS exfil; "fixed 2025-06-06" | P: product/class right; DNS detail and dates come from Embrace The Red, not NVD; NVD fix = v1.0.4 |
| CVE-2025-59536 | Claude Code <1.0.111: bug in startup trust dialog; code in project executed **before** user accepted trust. Published 2025-10-03 | ".mcp.json consent bypass" | P: NVD is generic pre-trust code execution; ".mcp.json" is Check Point's detail (secondary) |
| CVE-2026-21852 | Claude Code <2.0.65: repo settings `ANTHROPIC_BASE_URL` made requests before trust prompt, leaking API keys. Published 2026-01-21 | as stated | C |
| CVE-2025-53773 | "command injection in GitHub Copilot and Visual Studio allows local code execution", published 2025-08-12 | agent writes auto-approve setting -> YOLO RCE | P: product right; mechanism from Embrace The Red/MSRC, NVD text is generic |
Not checked: CVE-2025-54795, -54135/-54136, -32711 (search-only in D12).

## 4. Vendor / host claims (verbatim <15 words; dated 2026-11-15)
| Item | Cited in | V | Evidence (URL) |
|---|---|---|---|
| Only exit 2 blocks; other exit/crash/timeout proceed | D12/D01 | C | "your hook exits with any other code... The action goes ahead" - hooks.md |
| `onFailure:"block"`, v2.1.295+ | D12 | C | "Requires Claude Code v2.1.295 or later" - hooks.md |
| Events it does not cover | - | C (new) | No effect on `Stop`, `SubagentStop`, `TaskCompleted`, `TeammateIdle`, and async/asyncRewake background hooks; PermissionRequest failure = deny; unset on Windows w/o Git Bash can block. |
| Plain PostToolUse stdout reaches Claude | D05 | C (it does NOT) | Plain stdout reaches Claude only on UserPromptSubmit/UserPromptExpansion/SessionStart/PostModelSwitch (+PreCompact). PostToolUse needs `additionalContext` JSON or exit 2 stderr. |
| Hooks run inside subagents | D12 | C | "also run inside subagents" - hooks.md |
| SessionStart has `model` | D03/D05 | C (nuance) | "Only SessionStart hooks can receive a `model` field, and Claude Code doesn't always include it" |
| Multi-hook precedence | task | C | "precedence is `deny` > `defer` > `ask` > `allow`" (PreToolUse); `additionalContext` from all hooks is delivered. |
| Skill listing budget | D03 | C | "budget scales at 1% of the model's context window"; least-invoked descriptions dropped first; 1,536-char cap (description+when_to_use); inspect via `/doctor`, `/context`, `--debug`; `skillListingBudgetFraction`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`. |
| Agent same-name precedence | D03 | C | Table: managed 1 > `--agents` 2 > project 3 > user 4 > plugin 5. Same-dir duplicate names: filesystem order. |
| `memory:` adds tools | D03 | C | "Read, Write, and Edit tools are automatically enabled" - sub-agents.md (all scopes incl. project) |
| Subagent model order | D03 | C | per-invocation > frontmatter > `CLAUDE_CODE_SUBAGENT_MODEL` > parent |
| CLAUDE.md = context | D12 | C | "treats them as context, not enforced configuration" - memory.md |
| Rules w/o `paths` loaded at launch; user/project rule conflicts | D03 | C | memory.md |
| Sandbox off by default; Bash+children only; Read/Edit/Write not covered | D12 | C | "The sandbox is off by default"; "A `denyRead` entry doesn't stop the Read tool" - sandboxing.md |
| Bash rule not a boundary; `Read(...)` deny | D12 | C | "isn't a security boundary around the program" - permissions.md; file tools use `Read(./.env)` deny (best-effort for Grep/Glob). |
| `claude plugin eval` | task | C | Exists; needs Claude Code >=2.1.269, git>=2.31; 3 runs/case, with-arm + no-plugin without-arm; graders regex/tool_used/tool_order/file_exists/llm/baseline, no custom code; per-case `model`, `--judge-model`; plugin must have `evals/`. Applies to plugin skills/agents only (`skillOverrides` doesn't). |
| Commands exist | D10 | C | /plan, /code-review, /security-review, /simplify, /verify, /batch, /goal, /loop, /rewind all in commands.md. `/verify` = run the app and observe, not build+lint+test+coverage. |
| Auto mode 93%, FNR 17% (n=52), FPR 0.4% | D11/D12 | C | anthropic.com/engineering/claude-code-auto-mode (2026-03-25): "users accept 93%"; real overeager n=52; 5.7% synthetic exfil. Vendor self-report. |
| Research system +90.2%, ~15x tokens | D11 | C | anthropic.com/engineering/multi-agent-research-system (2025-06-13); tokens explain 80% variance; "most coding tasks involve fewer truly parallelizable tasks". Opus 4/Sonnet 4. |
| Harness post | D08/D09/D11 | C | Solo 20 min $9 vs full 6 hr $200; sprints removed w/ Opus 4.6; planner kept, evaluator single pass; V2 3h50 $124. N=1 app each. |
| 2026-09-09 report | D08 | C (reframe) | anthropic.com/news/alignment-assessment-cybersecurity-incidents: 4 incidents; misconfig left internet open (partner Irregular, per search coverage); malicious PyPI pkg installed on 15 hosts. It is an eval-environment misconfiguration, not a bypass of a Claude Code sandbox. |
| Skills "too prescriptive" | D08 | C | "Skills developed for prior models are often too prescriptive for Claude Fable 5" - prompting-claude-fable-5.md |
| PI robustness 8.0->1.4 (Opus 4.5) | D12 | P | Page 2025-11-24 confirms 100-attempt BoN attacker and "1%... meaningful risk"; per-model percentages are in a chart not extractable as text. Opus 5/Fable PI numbers in D08 are press-only (not opened). |
| Models D08 | D08 | C | overview.md: claude-fable-5-2 $8/$40; opus-5-5 $4/$20; sonnet-5-5 $2/$10; haiku-5-5 from $0.10/$0.50; 1M ctx/128K out; Mythos 5.2/5.1/5 limited availability ($8/$40, $10/$50). OpenAI models page: gpt-6-astra $10/$50, gpt-6.1-sol $2/$10, gpt-6.1-terra $1/$5, gpt-6-luna $0.1/$0.5. aistudio models page: gemini-4-carbon/argon/hydrogen (no prices read). HF API: DeepSeek-V4.1-Flash-1017 (MIT, 2026-10-17), Kimi-K3.1-Pro (2026-11-02), GLM-5.3 (2026-08-25), Qwen3.8-27B (Apache-2.0). Release dates 2026-11-09 for Fable/Mythos 5.2 NOT checked. |
| Cognition 2026-04-22 | D11 | C | cognition.ai/blog/multi-agents-working: original "still hold for parallel-writer swarms"; endorses one-writer-plus-advisors. |
| METR 2026-03-10 | D08 | C | 296 PRs, 4 maintainers, grader +24.2 pp (SE 2.7), golden 68%. Models <= Sonnet 4.5/GPT-5. |
| TB 2.x | D08 | C | icml.cc/virtual/2026/82793: 28/89 tasks (31%) defects; "up to 29.9 pp" codex->terminus-2, budget closes gap. |
| LangChain +13.7 | D08 | C | 52.8->66.5, gpt-5.2-codex fixed, no per-change ablation. |
| Snyk ToxicSkills | D12 | C | 3,984 skills (2026-02-05); 76 confirmed malicious; 534 (13.4%) critical; 1,467 (36.82%) any issue. (Page title says "36%... 1467 Malicious Payloads" - misleading; text matches D12.) Recall table not re-checked. |
| Nx 2025-08-26 | D12 | C | nx.dev/blog/s1ngularity-postmortem; tried Claude/Gemini local CLIs; GitHub Actions injection. |
| SLP article | D11 | C | Reachable (HTTP 200). Subjective, personal projects, 47-tests anecdote present; no experiments/baselines. Cites 2608.21156 as separate survey. "No termination section" not exhaustively checked (heading list not enumerated). |

## 5. Citations to remove or correct
1. D11 F-D11-04 / table row / decision line "CAID +4..+26 pts at 1.7-2.8x": correct to +3.6..+25.6 pts, cost 1.7x-4.3x; Claude-only gain ~+6 pp.
2. D11 "RESEARCH-SUPPORTED: MAS not better than SAS at matched budget on SE" must say: one SE source (2512.08296), 20-instance SWE-bench subset, 2025 models; paper's thesis is task-dependence (+80.8% .. -70%).
3. D09 SkillsBench line: replace with live numbers (87 tasks, +16.6, SE +11.6, self-generated -8.1..-11.5, 13/87 negative) or drop.
4. D11 2609.04217: keep at zero weight; also add 2603.13258 to the anomaly list (D12).
5. D12 F-D12-02/D05: keep, but note `onFailure` excludes Stop/SubagentStop/TaskCompleted/TeammateIdle.
6. D12 CVE-2025-59536 / -53773 / -55284: attribute mechanism details to Check Point / Embrace The Red, not NVD.
7. D12 "2602.11988 (ICLR 2026)" and D09 "NeurIPS 2026" venue labels: unverified.
8. D08 F-D08-14 (Opus 5/Fable injection %): press-only; keep labelled secondary.

## 6. Re-graded evidence for the five conclusions
| Conclusion | Independent primary sources actually confirmed | Models/dates | Grade |
|---|---|---|---|
| (a) MAS does not beat single agent at matched budget on SE | 1 SE matched-budget (2512.08296, n=20 SWE-bench tasks); 1 competitive-programming (2605.08478, agent vs k-shot, not MAS); 2 non-SE (2604.02460 QA, 2505.18286 mixed); 2609.04217 zero weight. Counter: CAID +6 pp (Claude 4.5) to +25.6, not equal budget; Anthropic research +90.2% non-SE | All <= early 2026; newest Sonnet 4.5/Opus 4.x, Gemini 2.5; no Opus 5.x/Fable | **Weak RESEARCH-SUPPORTED** for "not reliably better"; **HYPOTHESIS** for "does not beat" on 2026 models. Decomposition/isolation case is contested, not refuted. |
| (b) Context files/extra instructions give no success benefit | 1 direct study (2602.11988, multiple agents/models); related: 2510.05381 (length hurts), Anthropic Fable prompting doc (vendor), SkillsBench self-generated skills negative | GPT-5.x/Sonnet 4.5-era, Feb 2026; SkillsBench Opus 4.7/GPT-5.5 | **RESEARCH-SUPPORTED (single primary)** for LLM-generated files; dev-written +2.4% n.s. (trend positive, not zero). Does not test MeowKit-style gates/workflow rules; cost +20% is the robust finding. |
| (c) Prompt-level injection defences fail under adaptive attack | 1 strong primary (2510.09023, 12 defences, human red team) + vendor data (Opus 4.5 ASR falls but "meaningful risk"); 2403.14720 shows static success | Gemini 2.5 Pro, Llama-3.3-70B-era; Oct 2025 | **RESEARCH-SUPPORTED (strong for research defences)**; for MeowKit's prose rule on 2026 frontier models it is INFERRED/UNKNOWN. Safe to say "not a boundary", not "ineffective". |
| (d) Fresh-context review ~ same-session single review | 3 papers, all same single author/design (2603.12123, 2603.16244, 2610.01471); 30 artifacts, injected errors, mostly non-code, Korean-language artifacts; author's own v1 claim reversed; unverified-run exclusion | Claude Opus 4.6, Gemini 2.5, GPT-5.4; Mar-Oct 2026 | **Weak**; effectively one lab, n.s. result = absence of evidence not equivalence (paper says so). Label HYPOTHESIS-leaning-supported; do not use as basis to remove reviewer. Only robust bit: repeated same-session review (SR2) is worse; multi-turn adds FPs. |
| (e) Skill selection accuracy degrades with skill count | 2601.04748 (count scaling, synthetic, 2 GPT-4o models, single author); 2604.04323 (34k-pool retrieval degrades, Opus 4.6, not count-controlled); SkillsBench focused (<=3 modules) > bundles | 2024 models for the only count curve; Opus 4.6/4.7, GPT-5.5 for others | **Weak**; direction RESEARCH-SUPPORTED, magnitude for 128 skills with 2026 models and host listing budget (1%, 1,536-char cap, trimmed least-used) is HYPOTHESIS. MeowKit-specific loss is measurable via `/doctor` + `claude plugin eval` tool_used grader. |

What changes if PARTIAL items are removed: D11 H4 verdict loses its only quantitative SE anchor reading (-2..-15% on 20 tasks) and CAID cost gets worse (4.3x), so "parallel isolated workers" is a cost-benefit KEEP-only-if-decomposable call; D12 conclusions are barely affected (CVE/mechanism detail is host-docs-backed anyway); D09/D08 skill claims lose SkillsBench specifics but live numbers point the same direction (self-generated skills worse).

## 7. Could not open / not verified
Anthropic system-card PDFs; OpenAI GPT-6 announcement and SWE-bench-Verified retirement post; Opus 5/Fable PI figures; Fable/Mythos 5.2 release dates; Gemini 4 pricing; Cognition 2025 original; Chroma context-rot; Anthropic C-compiler post; building-effective-agents; METR productivity RCT; Snyk recall table; Embrace The Red/Check Point/Invariant/Pillar posts; CVE-2025-54795/-54135/-54136/-32711; per-model numbers in Anthropic 2025-11-24 chart; SLP article termination-section absence (not exhaustively read); 2506.08837, 2606.15057, 2606.10525, 2507.11538, 2511.04064, 2511.00872 numbers. qwen-code threshold skipped per instruction.
