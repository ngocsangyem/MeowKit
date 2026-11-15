# D09 — Harness course, Pocock skills, skill engineering (2026-11-15)

## 1. Scope & coverage inventory

Examined (all VERIFIED by reading unless marked):
- `walkinglabs/learn-harness-engineering` shallow clone, SHA `a9342ff471f2c0e60be0c08b9f4a7c502df4e442` (commit date 2026-10-22), license MIT. Clone: scratch `d09/lhe`. Read in full: lecture 01 (+code header), lecture 11 (index + `code/runtime-logger.ts` header, rubric), lecture 05 evidence paragraph, project 01 protocol, README "evidence" section, `docs/en/harness-designs/{index,pi}`, `skills/harness-creator/` (SKILL.md, memory reference, `scripts/run-benchmark.mjs`, `scripts/lib/harness-utils.mjs` scoring code, `evals/evals.json`). `tools/audit-harness.sh` header only.
- `mattpocock/skills` shallow clone, SHA `5863806dd4e15c63174bee4e7515a4256792ecfa` (v1.3.2, MIT, single squashed commit dated 2026-11-12; depth-1 so no history). Measured all 39 `SKILL.md`; read README, SCOPE.md, `.out-of-scope/new-skills.md`, `writing-for-agents/SKILL.md` + `SKILL-MECHANICS.md`.
- Live primary docs: Anthropic Agent Skills overview (platform.claude.com), Claude Code skills docs (code.claude.com/docs/en/skills), agentskills.io spec + home + "optimizing descriptions", Anthropic harness-design post, pi-mono README, Zechner Pi blog, mini-swe-agent README, arXiv abstracts/HTML for 2601.04748, 2604.04323, 2602.12670 (via search), 2602.11988 (via search snippet).
- MeowKit `.claude/skills/*/SKILL.md` (128) measured by script; cook/fix/review/grill/jira frontmatter read.

NOT done: lectures 02-10, 12-14 bodies (only skimmed headings/line counts); projects 02-08 code; Terminal-Bench leaderboard page (not fetched; Zechner's numbers are images); SWE-bench bash-only leaderboard (404 on guessed URL); aihero.dev articles and Pocock posts/talks (NOT fetched — Part 2 rests on his repo files only); Anthropic `best-practices` and engineering skills posts (not fetched; only overview + CC docs); Codex/Cursor/Gemini/OpenCode skill-loading behaviour (not verified; see UNKNOWN); the final 20k chars of the Claude Code skills page; full text of arXiv papers (abstract/HTML partial; SkillsBench and AGENTS.md numbers come from search snippets, marked).
- No third-party scripts were executed. Prompt-injection observations: none targeting agents found in cloned content (lhe `CLAUDE.md` is ordinary repo guidance; not followed).

## 2. Findings

### Part 1 — Learn Harness Engineering

**F-D09-01 — Lecture 01 thesis is a heuristic, not a causal finding. [VERIFIED text; INFERRED assessment]**
Claim: "When things fail, don't swap the model first — check the harness"; "nine times out of ten the problem lives in one of those layers"; "one AGENTS.md might be more effective than upgrading" (`docs/en/lectures/lecture-01-*/index.md`). Evidence cited: (a) Anthropic retro-game anecdote, (b) OpenAI Codex million-line post, (c) an unsourced FastAPI "team" story, (d) SWE-bench 77.2% headline. "Nine times out of ten" and "failure rates spike sharply >30 min" have no citation. The course README calls (a) "a controlled experiment"; Anthropic's own post is one prompt, one run per arm, author's judgement, 20 min/$9 vs 6 h/$200 (>20x cost), "not presented as controlled experiment" (WebFetch of anthropic.com/engineering/harness-design-long-running-apps). **CONTRADICTED**: README "controlled experiment" vs source. Also the lecture's own text says the full harness result was "not finished".
Assessment: useful as an ordering heuristic (cheap-to-check first: spec, verification command, env are cheap; model swap is costly) — INFERRED. Unjustified as causal attribution: the lecture supplies no failure-attribution base rate, and the same source post says harness parts "encode an assumption about what the model can't do" and that sprints/context resets were *removed* when Opus 4.5/4.6 improved (so harness benefit is model-relative: supports H2).
Controlled comparison would need: fixed task set (n>=30 across repos), pre-registered success tests independent of agent self-report, arms = {model A/B} x {harness 0/1/2}, >=5 trials per cell (nondeterminism), equal token/time budget or cost-normalised reporting, blinded grading, report interaction effect model x harness.
Counter-evidence where model/context was binding: (i) `Evaluating AGENTS.md` (arXiv 2602.11988, ICLR 2026): LLM-generated context files did not improve and cost >20% more; developer-written files gave modest gains — RESEARCH-SUPPORTED, numbers from search snippet only (UNVERIFIED in paper text) — directly undercuts "AGENTS.md beats a model upgrade". (ii) mini-SWE-agent: a fixed ~100-line bash-only scaffold scores ">74% SWE-bench Verified" while its bash-only leaderboard compares *models* under one harness, i.e. model variation is the independent variable (README via WebFetch; leaderboard numbers NOT read). (iii) Anthropic post: out-of-box Claude was a weak QA agent even inside a harness — evaluator needed several tuning rounds and still missed bugs (model limitation inside the harness).
Why it matters: MeowKit's "workflow compensates" posture needs the same model-x-harness interaction test (see E1).

**F-D09-02 — Most lecture "code" is deterministic simulation, not measurement. [VERIFIED]**
`lecture-01/code/failure-pattern-demo.ts` implements `modelDecide()` as hard-coded `if (!has("auth"))…` branches — a scripted toy "model". Lecture 05 text states "the companion code is a teaching simulation, not a measurement of model performance" and removed earlier percentage claims (honest self-correction, `lecture-05-*/index.md:150`). Lecture 11 `runtime-logger.ts` header: "Simulated pipeline with a seeded failure". Treat as educational example.

**F-D09-03 — Lecture 11 observability: concepts yes, collectors no. [VERIFIED]**
Implemented: one 260-line TS demo contrasting ad-hoc vs structured JSON logs on a seeded failure (`code/runtime-logger.ts`); a 5-line rubric (1-5 per Grounding/Citation/Functionality/Coherence) and a 12-line sprint-contract template (markdown). NOT implemented: OpenTelemetry — grep for `opentelemetry|otel|jaeger` across non-translated repo finds only `lecture-11/index.md` prose (and an anchor-map); no exporter, schema, collector, or span code. The "dark mode 45 minutes, 3-4 cycles" scenario is hypothetical narrative. The only quantitative table (planner/build/QA costs, total 3h50m/$124.70) is quoted from Anthropic's DAW run — a single run, not a result of this repo. Project 06 ("runtime observability") exists as Electron starter/solution; no tests found (`find projects -name '*test*'` → none).

**F-D09-04 — harness-creator scoring is purely structural. [VERIFIED]**
`skills/harness-creator/scripts/lib/harness-utils.mjs:220-` `scoreHarness()`: 25 boolean checks (5 per subsystem). Checks are file-existence, valid-JSON-shape of `feature_list.json`, and case-insensitive substring "any-of" needle matches (`textHas`: `needles.some(...)`) over AGENTS.md/CLAUDE.md, init.sh, progress.md, handoff — e.g. instructions pass if heading/list lines contain "Startup Workflow" OR "Before writing code". `structuredText()` keeps only headings/list/table/fence/bold-lead lines to resist keyword-stuffing, but still matches strings, not behaviour. Score = round(passed/5 x5), overall % of 25. `run-benchmark.mjs`: (1) self-check scaffolds a throwaway harness via its own `create-harness.mjs` and requires >=90 — a tautology test of the generator against its own checker; (2) scores target; (3) `scoreEvals()` checks only that `evals.json` has >=10 cases whose *names* match regexes (/memory/, /tool|permission|safety/…) and that each has prompt/expected_output/>=3 expectations. The 10 evals in `evals/evals.json` are never executed against an agent anywhere in the repo (no runner, grader, or with/without arm). SKILL.md itself admits: "this is a structural benchmark… Real effectiveness still needs before/after agent sessions" and "Treat the lowest score as a candidate bottleneck; confirm with failures, logs, or task outcomes". Verdict: measures structural completeness only; zero behavioural/outcome measurement. "Bottleneck" naming is label of lowest structural score, not causal. Gameable by headings.
Contrast: Anthropic skill-creator eval loop (CC docs) measures with-vs-without pass rate, tokens, time, blind A/B, trigger rate — the missing half. [DOCUMENTED]

**F-D09-05 — Memory material: design pattern text, no verification or injection treatment. [VERIFIED]**
`references/memory-persistence-pattern.md`: layers (instruction / auto-memory / session-extraction); two-step save (topic file then index pointer); index capped ~200 lines/25KB; "Local overrides win — always" (org→user→project→local, "final say"); "Derivable content doesn't belong in memory". "Evidence" section says "grounded in production agent runtimes including Claude Code's memory system" — no citation to a primary source, no test. Gaps: grep for `injection|poison` in `skills/` and `docs/en` hits only a SECURITY.md one-liner template and README bullets; memory entries are not treated as untrusted data; local-override-wins lets a repo-local file silently override org policy (the doc lists it as a tradeoff, "global rule can be silently overridden") — a prompt-injection/privilege concern for repo-controlled files. No staleness verification, no promotion review beyond "build review mechanism". Class: design pattern. Relevance: MeowKit memory rules (Rule 3: memory is DATA; org precedence) are stricter than this reference.

**F-D09-06 — "Pi / minimalism" claims: the course makes none that are performance claims; the leaderboard claim is Zechner's, and confounded. [VERIFIED course; VERIFIED-via-fetch primary]**
Course `harness-designs/pi/index.md` is a descriptive five-subsystem breakdown, scores marked "subjective, for comparison"; cites pi.dev docs and pi-mono README; no benchmark numbers; no controlled variable discussion. The only Terminal-Bench figure in the course is LangChain's (lecture 05): same gpt-5.2-codex, TB 2.0 89 tasks, 52.8%→66.5%, bundled changes (verification guidance, middleware, context mgmt) — course itself says it is "not a measured benefit of progress files alone". Primary sources:
- pi-mono README (github.com/badlogic/pi-mono): "minimal, extensible agent harness", no sub-agents/plan mode by default, MIT; **no benchmark or performance claims** (WebFetch).
- Zechner blog (mariozechner.at/posts/2025-11-30-pi-coding-agent/): ran Pi + Claude Opus 4.5 on Terminal-Bench 2.0, 5 trials/task; compared against harnesses each with *its own* model (confounds harness and model); scores only in images (not extracted); calls Terminus 2 (minimal tmux agent) competitive "per his reading of the leaderboard"; himself says benchmarks don't reflect real-world performance; "system prompt+tools <1000 tokens" and MCP token counts without method; sub-agents "anti-pattern" = opinion. Also notes error rates varied by time of day (PST) — an uncontrolled infra variable.
- mini-SWE-agent: ">74%" with ~100-line bash-only agent; "beats Claude Code and Codex on DeepSWE" is a README news item — model, budget, and trial count not stated on the README (WebFetch). 
Control audit (model / tools / instructions / environment / benchmark / budget): Zechner — benchmark fixed, trials stated; model NOT matched across harnesses; tools/instructions differ by design (that is the treatment); budget not reported in text; environment (API load) varied. => supports "a minimal harness can be competitive on one benchmark" (weak), not "minimal beats rich" (UNKNOWN, no matched-model ablation). To settle: matched-model leaderboard slices from tbench.ai (NOT fetched).

**F-D09-07 — Course teaching → evidence class (see table T1). Overall: the course is educational + structural validation; it contains no controlled experiment of its own and no production-reliability data. [VERIFIED/INFERRED]**
Project 01 protocol (run weak vs strong harness once each, "do not modify code", isolated dirs) is a thoughtful contamination-aware design but n=1 per arm, timer-only, a learner exercise.

### Part 2 — Matt Pocock (original sources: github.com/mattpocock/skills only)

**F-D09-08 — Measured shape of the Pocock catalog. [VERIFIED, SHA 5863806…]**
39 SKILL.md (engineering 20, in-progress 9, misc 4, productivity 7 incl. grill-me and grilling). Lines (whole file incl. frontmatter): min 7, median 75, mean 72, p90 120, max 170. Description chars: min 29, median 125, mean 142, p90 243, max 421. **24 of 39 (62%) are `disable-model-invocation: true`** (user-invoked, human-facing one-line description). Skills carry 1-6 sibling files (median 1-2). Several are 7-17 lines (`grill-me` 7, `wait-what` 7, `grill-with-docs` 7, `implement` 17). Model-invoked set (15) has descriptions ~150-420 chars; user-invoked ones 29-250.
Why matters: external exemplar is *small and mostly manual*; MeowKit median is 115 lines / 108.5 chars desc / 0 user-only (T2).

**F-D09-09 — Stated design philosophy (opinion, verifiable in repo). [VERIFIED text; OPINION]**
README: skills "small, easy to adapt, and composable… work with any model"; contrasts with process-owning frameworks "GSD, BMAD, Spec-Kit" that "take away your control". `writing-for-agents/SKILL.md`: two budgets (context load vs cognitive load); description = "context pointer"; every always-loaded word "earns even harder pruning"; progressive disclosure framed as *protecting the information hierarchy / variance*, "not primarily a token optimisation"; split only when cut earns it (by sequence, by invocation); prefer positive over negated instructions ("negation drags the forbidden behaviour into context"); prune "no-ops" the model already obeys, "settle by running the document, not by debate"; environment is source of truth, docs are caches. `SKILL-MECHANICS.md`: user-invoked skills cost zero context but cost human memory; mitigate with a user-invoked *router skill* (`ask-matt`) that can only hint. `.out-of-scope/new-skills.md`: catalog "deliberately small"; "if you can compose the behaviour from existing skills, it doesn't get a new skill"; each skill is "permanent maintenance surface". `SCOPE.md`: change accepted only with an **observed failure** in a real session.
Demonstrated vs opinion: all of the above are design opinions; the "observed failure" bar is a *process* for accepting changes, not an evaluation. **No evals, benchmarks, trigger tests or pass-rate data exist in the repo** (grep for eval/benchmark hits only docs prose, a software-factory observability note; `ls` shows no eval dirs). Claims "work with any model" and "composable" are UNKNOWN as measured outcomes. README "my most popular skills" and "~60,000 newsletter subscribers" are self-reported popularity, not effectiveness.
Quote policy: no quotes taken from posts/talks; only repo text paraphrased. Aihero articles not checked.

**F-D09-10 — Description style in the Pocock set vs standard guidance: tension. [VERIFIED + DOCUMENTED]**
Pocock: short, front-loaded trigger word, one trigger per branch, no synonyms ("grilling": "Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases"). agentskills.io "optimizing descriptions": "use imperative phrasing", "err on the side of being pushy", list contexts "even if they don't mention the domain" (DOCUMENTED). These pull opposite ways on length/keyword coverage; neither source reports measured trigger-rate for its recommendation. Also standard notes agents "only consult skills for tasks beyond what they can handle alone" — so trigger accuracy depends on perceived task difficulty, not only wording (DOCUMENTED).

### Part 3 — Skill engineering primary facts

**F-D09-11 — Format and budgets. [DOCUMENTED]**
- Open standard `agentskills.io` (originally developed by Anthropic, open; spec): required `name` (<=64, lowercase/digits/hyphens, must match dir) and `description` (<=1024 chars); optional license, compatibility (<=500), metadata, allowed-tools (experimental). Progressive disclosure: metadata ~100 tokens/skill always; SKILL.md body "<5000 tokens recommended", "under 500 lines"; resources on demand; references one level deep.
- Anthropic overview: Level 1 ~100 tokens/skill; Level 2 <5k tokens; "you can install many Skills without context penalty" (claim; see F-D09-12 for contrary mechanics).
- Claude Code (code.claude.com/docs/en/skills): listing always contains every skill *name*; description budget "scales at 1% of the model's context window"; on overflow Claude Code "drops descriptions starting with the skills you invoke least"; per-entry `description`+`when_to_use` capped at 1,536 chars (`skillListingMaxDescChars`); settings `skillListingBudgetFraction`, env `SLASH_COMMAND_TOOL_CHAR_BUDGET`, `skillOverrides: "name-only"`; `disable-model-invocation: true` removes the description from context entirely; invoked SKILL.md stays in the conversation, after compaction only first 5,000 tokens per skill re-attached within a 25,000-token shared budget; docs say rules that must hold *every time* belong in a **hook**, not a skill; `/doctor`, `/skill-doctor`, `claude plugin eval` (with `tool_used: Skill` grader) exist.
- Other hosts (Codex, Gemini CLI, Cursor, OpenCode, Copilot, Pi): Pocock's README lists install commands for each (VERIFIED as claims of his installer paths). Whether each host applies a listing budget, truncation, or different frontmatter semantics: **UNKNOWN** — verify per-host docs.

**F-D09-12 — Observed in THIS session (host = Claude Code): the listing already overflows for MeowKit-class catalogs. [VERIFIED in-session, INFERRED cause]**
The skill listing supplied to this agent shows full descriptions only for roughly the first ~37 of MeowKit's `mk:*` skills; the remaining ~90 appear as bare names (e.g. `devops (mk:devops)`, `jira-*`, `confluence`-adjacent leaves have no description). Consistent with the documented 1%-of-window budget. Combined with 39 other host skills the catalog is ~170+. So for those names-only skills, trigger relies on the name alone. (Caveat: which ones get descriptions follows usage recency per docs; ordering here may reflect that rather than alphabetical.) Not a controlled measurement; the lead should re-check with `/doctor` on a live session. MeowKit's own total description volume: 13,988 chars (~3.5k tokens, INFERRED at ~4 chars/token) — so the cost is small in absolute terms vs. the descriptions being dropped; the budget cap, not MeowKit's description length, is binding.

**F-D09-13 — Published scaling / trigger evidence is thin and stale-model. [RESEARCH-SUPPORTED, with caveats]**
- arXiv 2601.04748 ("When Single-Agent with Skills Replace Multi-Agent Systems and When They Fail"): **synthetic** libraries 5-200 skills, **GPT-4o-mini and GPT-4o only**, temp 0, 3 seeds. Accuracy >90% at <=20 skills, declines beyond ~30, ~20% at 200; fitted half-accuracy size κ≈91.8 (mini) / 83.5 (4o); semantic confusability matters more than raw count (one competitor/skill -7 to -30%, two -17 to -63%); hierarchical routing at >=60 skills ~72-85% vs flat ~45-63%. Caveats: author notes inflection earlier than κ; synthetic skills; old models; routing-only (not end-task success). No frontier-model (2026) replication read.
- arXiv 2604.04323 ("How well do agentic skills work in the wild"): 34k-skill pool; gains "fragile", approach no-skill baseline in hardest settings; retrieval+refinement raised Claude Opus 4.6 on Terminal-Bench 2.0 57.7→65.5% (abstract). Search snippet adds forced-load 55.4% vs agent-decides 51.2% for Claude (snippet only, UNVERIFIED).
- SkillsBench (arXiv 2602.12670, NeurIPS 2026): 84 tasks, 7 configs, ~7.3k trajectories; curated skills +16.2pp avg (SWE +4.5pp, healthcare +51.9pp, 16-18 tasks regress); self-generated skills ≈ flat/negative (-1.3pp); focused skills with 2-3 modules beat comprehensive docs (search-result summary; numbers differ across versions; abstract/full text not read).
- SkillRouter (80k pool): name+description only → 31-44% routing-accuracy drop vs full body (search snippet only; UNVERIFIED).
- Not found: any public measurement of frontier-model skill-trigger accuracy at 100-130 skills with a Claude Code-style listing. => the degradation threshold for MeowKit's scale is UNKNOWN.

### Part 4 — Implications for MeowKit (data)

**F-D09-14 — MeowKit vs exemplars, measured. [VERIFIED by script over `.claude/skills/*/SKILL.md`]** See T2. Key: median 115 lines (Pocock 75), max 357 (<500, within spec); description median 108.5 chars, p90 128, max 159 (Pocock median 125, p90 243) — MeowKit descriptions are *shorter* and uniform ("Verb phrase — … NOT for mk:x. - Use when…"); 128 skills with 0 `disable-model-invocation` (119 `user-invocable: true`, 9 `false`) so every description is a model-facing pointer; 23 of 128 (18%) are jira/confluence family (hub `mk:jira` + 17 leaves + 8 agent files); skill dirs hold 933 non-SKILL files (references/scripts) — progressive disclosure is heavily used (cook 17, fix 17, review 29). SKILL.md total bytes 782,130. Quality of "NOT for" disambiguation matches the confusability literature's remedy (INFERRED), but the 2 skills without "NOT for" and the near-duplicates (`review` vs `review-pr` vs `code-review`-like, `plan-creator`/`planning-engine`, `advise`/`grill`/`office-hours`, `testing`/`verify`/`lint-and-validate`) are confusable-pair candidates (INFERRED, unmeasured).

**F-D09-15 — Hub+leaf evidence is indirect. [HYPOTHESIS supported by 2601.04748]** Hierarchical routing outperformed flat at >=60 skills in that paper; MeowKit's jira/confluence hub+leaf is that shape, but the host loads *every* leaf description regardless (no lazy tree loading), so the hierarchy only helps if leaves are `disable-model-invocation`/name-only. Currently they are model-invocable.

## T1 — Course module → evidence class

| Module | What it is | Class |
| --- | --- | --- |
| L01 failures are harness-first | Heuristic + 2 external anecdotes (n=1) | Educational example / heuristic |
| L01-L10 `code/*.ts` demos | Deterministic simulations (hard-coded "model") | Educational example |
| L02-L04 AGENTS.md short vs giant | Argument + demo; no ablation | Educational example |
| L05 continuity | Pattern; cites LangChain TB2.0 52.8→66.5% (bundled changes) | Educational + third-party behavioural (confounded) |
| L08 feature list validator | Script validating JSON shape | Structural validation |
| L09/L10 victory/e2e | Scripts + text | Educational / structural |
| L11 observability | Logger demo, rubric, contract; OTel prose only | Educational (runtime signals NOT implemented) |
| L12 clean state | Scanner/benchmark-runner scripts (simulation) | Structural validation (not read in depth) |
| L13-L14 loop/graph | Prompts + python graph demo | Educational (not read in depth) |
| Projects 01-08 | Learner exercises, n=1 per arm | Educational exercise (behavioural if learner runs it) |
| harness-creator scoring | Substring/file-presence checks | Structural validation only |
| harness-creator evals.json | 10 prompts, never run | Unexecuted eval definitions |
| Harness-design articles (Pi/Claude Code/Codex/DeepSeek) | Descriptive reverse-engineering, "subjective" scores | Educational / descriptive |
| Anthropic retro-game & DAW runs (cited) | Single runs, author judgement | Anecdotal behavioural (not controlled) |
| Anything | — | Controlled experiment: **none in repo**; Production-reliability: **none** |

## T2 — Skill size distributions (SKILL.md, incl. frontmatter)

| Set | n | Lines min/med/mean/p90/max | Desc chars min/med/mean/p90/max | User-only (no model desc) |
| --- | --- | --- | --- | --- |
| Pocock `mattpocock/skills` @5863806 | 39 | 7 / 75 / 72 / 120 / 170 | 29 / 125 / 142 / 243 / 421 | 24 (62%) |
| MeowKit `.claude/skills` @HEAD fc278b31 | 128 | 27 / 115 / 126 / 216 / 357 | 77 / 108.5 / 109 / 128 / 159 | 0 |
| harness-creator | 1 | 111 lines | ~720 chars (multi-sentence, "reach for it even if user never says harness") | 0 |
| Spec limits | — | <500 lines, <5k tokens body | <=1024 (CC listing cap 1,536) | — |
Named MeowKit skills: cook 297 lines/116 chars/17 ref files; fix 240/103/17; review 222/130/29; grill 226/131/0; jira (hub) 120/96/9; confluence (hub) 98/96/11; jira-issue 56/94/3. Descriptions by MeowKit are char-measured after YAML folding; may differ ±few chars.

## T3 — Claims with verified source URLs

| Claim | Status | Source |
| --- | --- | --- |
| Skill listing budget = 1% of context window; overflow drops least-used descriptions; per-entry cap 1,536 | DOCUMENTED | https://code.claude.com/docs/en/skills |
| Post-compaction re-attach 5k tokens/skill, 25k shared | DOCUMENTED | same |
| Metadata ~100 tok/skill; body <5k tokens; name<=64; desc<=1024; <500 lines | DOCUMENTED | https://agentskills.io/specification ; https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview |
| Description testing: ~20 queries, 3 runs, 0.5 threshold, 60/40 train/val | DOCUMENTED | https://agentskills.io/skill-creation/optimizing-descriptions |
| Anthropic retro-game 20 min/$9 vs 6 h/$200, single run, not controlled | VERIFIED(fetch) | https://www.anthropic.com/engineering/harness-design-long-running-apps |
| Harness components encode model-weakness assumptions; removed as models improve | VERIFIED(fetch) | same |
| Pi README: no benchmark claims | VERIFIED(fetch) | https://github.com/badlogic/pi-mono |
| Zechner TB2.0 run: Opus 4.5, 5 trials, cross-model comparison, numbers only in images | VERIFIED(fetch) | https://mariozechner.at/posts/2025-11-30-pi-coding-agent/ |
| mini-SWE-agent >74% SWE-bench Verified, ~100 lines, bash-only | VERIFIED(fetch, README) | https://github.com/SWE-agent/mini-swe-agent |
| Skill-library scaling (GPT-4o/mini, synthetic) | RESEARCH-SUPPORTED | https://arxiv.org/abs/2601.04748 |
| Skills "fragile" in realistic retrieval; TB2.0 57.7→65.5 (Opus 4.6) | RESEARCH-SUPPORTED (abstract) | https://arxiv.org/abs/2604.04323 |
| Curated skills +16pp, self-generated ≈0 | RESEARCH-SUPPORTED (snippet) | https://arxiv.org/abs/2602.12670 |
| AGENTS.md files: no reliable gain, +>20% cost | RESEARCH-SUPPORTED (snippet) | https://arxiv.org/abs/2602.11988 |
| LangChain TB2.0 52.8→66.5% same model | cited by course; not fetched | https://www.langchain.com/blog/improving-deep-agents-with-harness-engineering |

## T4 — Course/influencer claims NOT supported by controlled evidence

1. "Anthropic ran a controlled experiment" (course README) — single run per arm; CONTRADICTED by source.
2. "Nine times out of ten the problem lives in one of those layers" (L01) — no data.
3. "Agents without persistent state see failure rates spike sharply on tasks >30 minutes" (L01) — uncited.
4. "One AGENTS.md might be more effective than upgrading to a more expensive model" (L01) — contradicted in direction by 2602.11988 for generated files; unsupported for hand-written.
5. FastAPI "team" and "dark mode 45 minutes / 3-4 cycles" narratives — hypothetical, unsourced.
6. harness-creator "score" as reliability indicator — structural only; no outcome link; 10 evals never executed.
7. "In a well-harnessed repo Codex goes from unreliable to reliable" — qualitative OpenAI statement, no ablation (not fetched here).
8. Pi: "minimal harness is sufficient / long system prompts unnecessary" — Zechner's benchmark confounds model and harness; prompt length not isolated; his own caveat.
9. mini-SWE-agent "beats Claude Code and Codex on DeepSWE" — README news item; setup not read.
10. Pocock: skills "work with any model", "composable", "most popular", grilling "might be the single coolest technique" — opinion/popularity; no eval in repo.
11. Anthropic overview "install many skills without context penalty" — true for body tokens, contradicted at scale for the description listing by the CC budget mechanics and 2601.04748.
12. agentskills "be pushy" vs Pocock "prune hard" — neither backed by a published trigger-rate comparison.

## 3. Contradictions

- Course README "controlled experiment" vs Anthropic post (single run each, author judgement).
- Course lecture 05 self-disclaims fabricated percentages; README/L01 still use strong language ("hard truth", "evidence is clear") — internal inconsistency.
- harness-creator SKILL.md ("structural benchmark; effectiveness needs sessions") vs its report labels ("Ready for realistic before/after benchmarking", "Bottleneck") that read as outcome-relevant.
- Anthropic overview ("no context penalty for many skills") vs CC docs (1% budget, descriptions dropped).
- agentskills.io (pushy, broad descriptions) vs Pocock/`writing-for-agents` (front-loaded, one trigger per branch, prune).
- Pocock README says skills are model-independent; his own mechanics rely on host-specific `disable-model-invocation` (a Claude Code field; per-host support UNKNOWN) — he has `.out-of-scope/harness-name-collisions.md` acknowledging host differences (not read).

## 4. Decisions proposed

| # | Class | Decision | Observed problem / source | Causal hypothesis | Alternatives | Measurement |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | NEEDS MORE EVIDENCE | Do not split or merge skills on size alone | MeowKit median 115 lines, max 357 — within spec (<500); Pocock median 75 | Size is not the binding variable; trigger precision and description-budget are | Split big (cook/fix/review/grill ~220-300 lines), merge small | Per-skill with/without pass rate + tokens (skill-creator benchmark) on 10 skills spanning size quartiles |
| D2 | EXPERIMENT | Make a subset of skills user-only (`disable-model-invocation`) | 0/128 user-only; in this session ~90 of 128 MeowKit skills lost descriptions to budget (F-D09-12) | Skills that are only ever run via `/mk:*` command or from another skill waste listing budget and push out useful descriptions | Raise `skillListingBudgetFraction`; name-only overrides; keep as is | Trigger-rate on a 60-prompt set before/after on the skills that should auto-trigger; `/doctor` listing size; no drop in intended auto-invocations |
| D3 | EXPERIMENT | Hub+leaf for jira/confluence: switch leaves to name-only/user-only, keep hub model-invocable | 23/128 skills in two families; all leaves loaded as model-invocable | Hub-only discovery reduces confusable siblings (2601.04748: hierarchical > flat at >=60) | Flatten to one `jira` skill with references | Top-1 skill-selection accuracy on ~30 Jira/Confluence prompts, hub-only vs flat, 3 runs, Claude Code current model |
| D4 | IMPROVE | Add trigger-eval fixtures (20 queries x 3 runs, 60/40 split incl. near-miss negatives) per auto-invocable skill, starting with confusable clusters (review/review-pr, plan-creator/planning-engine, advise/grill/office-hours, testing/verify/lint-and-validate, fix/build-fix/investigate) | No trigger tests found in MeowKit; Pocock has none either | Confusable pairs are the main failure source (2601.04748) | Rely on "NOT for" text only | Trigger rate and false-trigger rate per cluster; regress on description edits |
| D5 | NEEDS MORE EVIDENCE | Description style: keep "verb phrase — … NOT for X. - Use when…" until A/B shows a loss | MeowKit descs are uniform, shortest (p90 128) vs standard's "pushy" advice | Shorter, disambiguated pointers trigger as well as long ones at lower cost | Longer "use even if the user never says X" descriptions | A/B same 60-prompt set, 2 description variants, trigger/false-trigger rate + listing tokens |
| D6 | DELEGATE TO HOST | Rules that "must hold every time" belong in hooks/CLI, not skills | CC docs say so; MeowKit already uses hooks for gates | Skill prose is followed probabilistically and compaction keeps only first 5k tokens | More skill text | Compliance rate of rule X as hook vs skill instruction over N sessions (E3) |
| D7 | REJECT | Do not adopt harness-creator's score as a MeowKit quality metric | Structural substring checks, unexecuted evals (F-D09-04) | Score ≠ outcome | Adopt skill-creator with/without benchmark | n/a |
| D8 | KEEP | `references/` progressive disclosure pattern; <500-line SKILL.md | 933 reference files, 0 skills >500 lines; aligns with spec and Pocock's ladder | — | — | Context tokens at skill load vs task success |

## 5. Experiments proposed (falsification)

- E1 model x harness interaction: 3 current Claude tiers x {native host, MeowKit workflow} x 30 tasks x 5 trials, cost and pass rate; falsifies "harness-first" if gap shrinks or reverses on newest model (tests H2/H1).
- E2 scaling: build 4 listings (30/60/130/200 skills incl. confusable pairs) in Claude Code on current model; measure top-1 and any-correct activation on a fixed 100-prompt set; falsifies the 2601.04748 curve at frontier scale. Also try listing with the budget exceeded vs raised (`skillListingBudgetFraction`).
- E3 skill vs hook: pick 3 "must-hold" rules (e.g. Gate 1 plan receipt); compare compliance as skill text vs hook over 20 sessions incl. post-compaction.
- E4 skill effectiveness: Anthropic skill-creator with/without runs for 10 MeowKit skills (cook, fix, review, grill, scout, jira, plan-creator, simplify, verify, investigate); falsifies "skill adds value" where pass-rate delta <= 0 or token overhead > benefit (SkillsBench shows negative deltas in 16-18/84 tasks).
- E5 description A/B (D5).
- E6 Pocock-style user-only conversion: mark 20 skills user-only, run 20 representative tasks; falsifies if users/agents fail to reach needed skills (cognitive load) — measure reach rate.

## 6. Unresolved questions

- Per-host behaviour (Codex, Cursor, Gemini CLI, OpenCode, Copilot, Pi): listing budget, truncation, frontmatter fields honoured — UNKNOWN; verify per-host docs/source.
- Actual numbers on tbench.ai for Pi/Terminus 2 vs others (Zechner's are images) — fetch leaderboard and compare matched-model rows.
- SWE-bench bash-only leaderboard model spread (my URL 404'd).
- Pocock original posts/talks on skills (aihero.dev) — not fetched; confirm whether he reports any testing practice.
- Verify 2602.11988 and 2602.12670 numbers against full papers (currently search snippets).
- Does the CC listing order in this session reflect usage-recency (documented) rather than alphabetical? Re-check with `/doctor` and `/context`.
- Is any MeowKit skill actually invoked automatically in practice (telemetry)? Needed before D2/D3.
