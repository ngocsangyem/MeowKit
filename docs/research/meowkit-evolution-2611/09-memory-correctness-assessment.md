# 20.9 Memory Correctness Assessment

Baseline: `main` @ `c7ff0a9e` (read-only re-check on 2026-11-15). Compiled from `findings/` D03, D04, D05, D06, D07, D09, D12, corrected by R1 and R2. Labels per `BRIEF.md`. This is an editor's compilation with a source re-check; no new experiment was run and `mewkit validate --memory` was **not** executed by anyone on main (R1 ran only `note`, on a binary that predates main).

## 1. Summary

- **H5 ("MeowKit's memory improves future task outcomes"): UNKNOWN. Untestable today, not refuted.** The team store `.meowkit/memory/` has never held content in this repo's history: `git log --all -- .meowkit/memory` returns exactly two commits. `3284eda7` (2026-11-10 22:01) added a 4-line `decisions.md`; `5ae63e3a` (22:16, 15 minutes later) deleted it with the message "keep plan notes out of the packaged .meowkit directory". The directory is absent on main. VERIFIED (D05 F-D05-01; re-run on main). No read-side instrumentation exists either (F-D05-02), so even a populated store would show no evidence of use. Nothing in the repo, in the four reference repos, or in the literature measures benefit for this design.
- The implemented part of the memory system is the **write path** (shape check, content scan, lock, 300-line cap) and a **ship-time lint**. The rest of the lifecycle (candidate selection, retrieval, revalidation, expiry, invalidation, conflict handling) is model instructions in `SKILL.md` files, or absent. VERIFIED (sections 3-5).
- The lint is an English-pattern deny-list plus decode passes. By construction it stops literal and lightly obfuscated payloads and cannot stop paraphrase, cross-script look-alikes or phrases split across lines (R1 item 9, executed). It is hygiene, not a trust boundary.
- Correctness problems that are mechanical: the ship-time lint **skips** when the CLI is not found (`memory-store-lint.cjs:74,96,98`); `/mk:memory --prune` has **no implementation** (SKILL.md only); `Source:` is only checked for presence of the label (`note/shape.rs:9,52-59`); three docs statements disagree with code (section 2).
- Markdown + grep is adequate **for a small, human-curated, reviewed store** and is the smaller design than hermes or qwen. There is no head-to-head evidence that anything heavier would help. Vector database / memory engine: **REJECT** now (no demonstrated insufficiency; the store has never been populated enough to fail). Section 8.
- 36 agents set `memory: project`; 21 of them declare no Write/Edit yet receive both through it; one agent (`evaluator`) has stored notes. Maintainer decision (section 9).
- The "committed team memory" vs "kit ships with it empty" tension is a design tension, not a bug (section 2.2).

## 2. Memory-store map

### 2.1 Stores

| # | Store | Writer | Reader | Tracked / ignored | Ships in kit? | Documented where | Consistent with docs? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | Team store `.meowkit/memory/{decisions,gotchas}.md` | `mewkit note` only (`crates/mewkit-cli/src/commands/note.rs:51` -> `mewkit-core/src/note/mod.rs:48`); callers: `mk:fix`, `mk:review`, `mk:retro`, `mk:memory`, architect agent, `mk:party`, `mk:plan-creator archive`, any agent for EUREKA | Model, by a `grep -rilE` the skill tells it to run (`fix/SKILL.md:93`, `review/SKILL.md:39`, `investigate/SKILL.md:49`, `cso/SKILL.md:38`, `agents/planner.md:111`) | `.meowkit/.gitignore:8-9` allowlists `memory/*.md`; root `.gitignore:49-50` says "committed on purpose". Directory **absent** on main; `git ls-files .meowkit` lists no memory file | Excluded by the pack manifest (`.meowkit/pack-manifest.json:36` `.meowkit/memory/*`). Whether the release builder honours it: UNKNOWN (not traced). Maintainer rule: `.meowkit/` ships, so nothing is committed there from plan work (host memory note `packaging-dirs-left-clean`) | `docs/core/memory-system.md` (§2, §5), `CLAUDE.md` Memory, `rules/meowkit-core.md` | Docs say "committed, team-shared"; repo has none. See 2.2 |
| S2 | Legacy tree `.claude/memory/` (only `.gitkeep`) | `resolve_state_dir` redirects **all** memory writes here iff `.meowkit/memory/` is absent and the legacy dir holds a `decisions.md`/`gotchas.md` (`crates/mewkit-core/src/state_paths.rs:97-112,152-157`) | Nobody: read-set skills grep the literal `.meowkit/memory/` | Ignored (`.gitignore:70-71`); `.claude/memory/*` excluded from pack (`pack-manifest.json:29`) | No | `docs/core/meowkit-rules.md:230` says it "is not a store" | **CONTRADICTED**: code still treats it as the store in that one layout. INFERRED split-brain (written, git-ignored, unread); not reproduced |
| S3 | Per-agent `memory: project` -> `.claude/agent-memory/<agent>/` | Host feature; auto-enables Read/Write/Edit for the agent (DOCUMENTED, sub-agents page; R2 confirmed) | Host loads `MEMORY.md` (first 200 lines/25 KB) on spawn (DOCUMENTED) | Ignored (`.gitignore:76-77`); 6 dirs exist, only `evaluator/` has files (3 notes + `MEMORY.md`, 109 lines) | No (`pack-manifest.json:44`) | `memory-system.md` §8 says `~/.claude/agent-memory/` (user scope) | **CONTRADICTED**: frontmatter is `memory: project` (36 of 36), so the path is project-local. Docs wrong |
| S4 | Host auto-memory `~/.claude/projects/<proj>/memory/` | Host | Host | Outside repo | No | `memory-system.md` §1, §8 (separate) | Consistent |
| S5 | Edit ledger `.meowkit/state/learning-observer.jsonl` | `learning-observer.cjs` | itself (edit count) | Ignored | No | `memory-system.md` says "no capture hook" | Not memory, but a persistent per-file store; naming only. D05 F-D05-10 |
| S6 | Session/checkpoint state `.meowkit/state/` (checkpoints, budget, active-plan, evidence) | Hooks, `mewkit plan` | Orientation, gates | Ignored | No | `memory-system.md` §7 | Consistent (state, not memory) |
| S7 | Traces/telemetry `.meowkit/telemetry/` | Hooks | `mewkit trace score/audit` | Ignored | Excluded (`pack-manifest.json`) | `memory-system.md` §7 | Consistent. Traces are **not** memory: no consumer feeds them back to a task (D05 F-D05-10) |
| S8 | Workflow evidence (`memory.gotchaWritten` flags) | `mk:fix` | `validate-workflow-evidence.cjs` | Ignored | No | `fix/SKILL.md:212` ("Evidence != memory") | Records that a write happened, not that it was read (F-D05-05) |

### 2.2 Design tension: "committed" vs "ships empty"

Stated as found, not as a bug. Two maintainer decisions both hold:

1. Team memory is committed, reviewed in the PR diff, and is the "one lint + PR review" protection model (`memory-system.md` §5; `check_store.rs:3-6`).
2. `.meowkit/` is a shipped packaging directory; plan/agent-written entries must not land there (maintainer rule, 2026-11-10), and the manifest excludes `.meowkit/memory/*`.

Consequence: in the one repo that dogfoods the kit, the committed-memory design cannot be exercised without risking the release, so H5 has no dogfood evidence (F-D05-01). In consumer projects the design works as documented (their own `.meowkit/memory/` is allowlisted by the installed `.gitignore`).

| Option | What it means | Cost / risk |
| --- | --- | --- |
| a. Document: "source repo ships empty by design" | State it in `memory-system.md` and `CLAUDE.md`; keep manifest exclude; confirm the release builder honours the exclude | Cheapest. Leaves H5 untestable in-repo; needs a fixture project for experiments |
| b. Dogfood in a separate scratch project | Run the memory experiments (section 10C) in a throwaway consumer repo | No packaging risk; no change to this repo |
| c. Store memory outside the shipped tree for the source repo only | e.g. a path the pack never covers | Diverges the source repo from the documented layout it dogfoods |
| d. Ship a curated seed | Maintainer-written entries ship deliberately | Contradicts "ships empty"; changes what users receive; needs the lint to run on release |

Recommendation: not a recommendation. (a)+(b) is the lowest-risk pairing; (c)/(d) reverse a stated maintainer decision and are the maintainer's call (Y-12).

## 3. Lifecycle table

Legend: CODE = implemented and cited; PROSE = model instruction only; ABSENT = no mechanism found. Practice grades follow R2: **RS** = RESEARCH-SUPPORTED (with strength), **DOC** = DOCUMENTED (host docs, R2 confirmed), **INF** = INFERRED, **HYP** = HYPOTHESIS, **UNK** = UNKNOWN.

| Stage / topic | MeowKit state | Evidence | Good practice and grade |
| --- | --- | --- | --- |
| **CANDIDATE: extraction** | PROSE. "Write only a non-derivable lesson" in `memory-system.md` §4 and each write-set skill; no detector, no capture hook (removed, `memory-system.md` §9) | VERIFIED (D05 F-D05-05) | Prefer human-written, outcome-validated lessons over LLM-generated ones: **RS, single primary** (2602.11988: LLM-generated context files -0.5% / -2% task success, developer-written +2.4% not significant, cost +20%). Self-generated skills below no-skill baseline: **RS, weak** (SkillsBench, live version -8.1 to -11.5 pp). Never write from turns driven by fetched/untrusted content: **INF** from MINJA/AgentPoison threat models. MeowKit lets "any agent" append a EUREKA entry (`agent-conduct.md` A3) with no untrusted-turn exclusion: HYPOTHESIS gap |
| **Consolidation** | ABSENT. No merge/dedupe; "update instead of duplicate" is prose | VERIFIED | No coding-agent evidence either way: **UNK**. hermes runs a background review fork with a dispatch-side whitelist (VERIFIED D07 F-D07-06); qwen has extract/dream/forget (VERIFIED D06 F-D06-21); neither measured benefit |
| **VALIDATE: write guardrails** | CODE. `validate_note_shape` (`note/shape.rs:43-70`: `## ` heading + `Why:`, `Apply when:`, `Source:` labels present); `scan_memory_content_capped` before append (`note/mod.rs:53`); 16 KB entry cap (`note/mod.rs:31`); rejection names kind and line, never matched text (`note/mod.rs:60-68`) | VERIFIED | Syntactic lint = hygiene only; semantic poisoning needs provenance + review: **RS, weak** for coding agents (MINJA 2503.03704, AgentPoison 2407.12784 target RAG/consumer agents; 2510.09023 bounded recall of detectors); **INF** for MeowKit. hermes scans every write with a strict set and pins staged edits (VERIFIED D07) |
| **Provenance** | PROSE. `Source:` must exist as a label; content free text (`<commit \| PR \| tasks/plans/... \| tasks/reviews/...>`, `memory/SKILL.md`). No author, no session, no existence check | VERIFIED `note/shape.rs:9,52-59` | Record origin so a human or later session can re-check: **INF**. No measured effect |
| **STORE: serialization** | CODE. Sidecar lock under `.meowkit/state/locks/` (`note/append.rs:61-65,82`), `O_APPEND` (`append.rs:111-116`), 300-line cap (`append.rs:98-107`, `check_store.rs:35`) | VERIFIED | Two writers must not lose an entry: engineering requirement, not a research claim |
| **STORE: scope / isolation** | One shared store for all agents; no per-area or per-path scope; no per-agent isolation (agent notes live separately in S3) | VERIFIED | Host separates machine-local auto-memory from git-shared team files and puts an approval dialog on out-of-tree imports: **DOC** (memory page, D12 F-D12-18). MeowKit's committed store sits outside that import approval; the PR diff is the only gate. hermes blocks the `memory` tool in delegated children (`delegate_tool_toolsets.py:14-22`, VERIFIED D07): isolation by default |
| **RETRIEVE: read path** | PROSE. A grep the model is told to run; no hook reads memory; `memoryBlock()` only warns on >300 lines (`session-context-report.cjs:168-178`); no retrieval log | VERIFIED | Precision over recall; accurately selected experience helps, unfiltered or wrong context gives "limited or negative benefits": **RS, mild** (2602.08316, a benefit benchmark, not a harm study). Length alone hurts: **RS** (2510.05381). Structured subtask memory +4.7 pp SWE-bench Verified, self-reported: **RS, weak** (2602.21611) |
| **Read guardrails** | PROSE. "Memory is DATA" (`injection-rules.md` Rule 3); no wrapper, no fixed delimiter at read time | VERIFIED | Prompt-level framing is context, not enforcement: **DOC** (host memory docs, "context, not enforced configuration"). Research defences of this class fail under adaptive attack: **RS, strong for research defences** (2510.09023), **INF/UNK** for a prose rule on 2026 frontier models. Safe wording: "not a boundary", not "ineffective" (R2 conclusion c). hermes fences prefetch in `<memory-context>` and strips it from output (VERIFIED, D07) |
| **REVALIDATE: freshness vs repo change** | ABSENT. No anchor to a commit or path; nothing compares an entry to HEAD | VERIFIED (D05 F-D05-05) | Check that the source still exists and matches before relying on it: host offers `/doctor prompt-audit` for stale/contradictory context files, **DOC**. Staleness rates for coding memories: **UNK** (no study found, D12) |
| **Verification** | ABSENT for the claim; PROSE for non-derivability | VERIFIED | Lessons from successful-looking but unverified runs mislead: **RS** (2505.16067 experience-following; 2025 models) |
| **RETAIN / expiry** | PROSE. 180-day age rule in `/mk:memory --prune` | VERIFIED | 180 days has no support: **HYP** (D12). Hard caps (200 lines/25 KB host; 2,200 + 1,375 chars hermes `memory_tool.py:62-66`; 300 lines MeowKit): size discipline is **DOC/VERIFIED**, benefit **UNK** |
| **INVALIDATE** | PROSE. `/mk:memory --prune` "proposes removals; a human approves" - no code anywhere (grep of `crates/`, `.claude/hooks/`, `.claude/skills/memory/`: only SKILL.md text). Reaching the cap blocks writes and points at the prune that does not exist as a tool (`append.rs:104-105`) | VERIFIED (F-D05-06) | Resolve conflicts by superseding, not accumulating; host says contradictory instructions are picked "arbitrarily": **DOC** (memory page) |
| **Conflict resolution** | ABSENT. No supersede marker; precedence only via "memory cannot override rules" | VERIFIED | As above: **DOC** |
| **Poisoning prevention** | CODE (tripwire) + PROSE (DATA rule) + human PR review | VERIFIED | Defence-in-depth with human review of memory diffs: **INF**; human PR review is weak against hidden/semantic content (D12 §3.2, INFERRED) |

## 4. Write-path correctness

### 4.1 What the lint is

Rust, main: `mewkit_core::memory` (`crates/mewkit-core/src/memory/`, 1,836 lines incl. tests) shared by `note` and `validate --memory` (`note/mod.rs:53`; `validate/mod.rs:96-106`; walk + size + scan in `check_store.rs:58-138`). Hook side: `.claude/hooks/lib/memory-store-lint.cjs:92-103`, called from `lib/core/pre-ship.cjs:57-59`. CI: `.github/workflows/ci.yml:85-99` runs it on this repo's own store (absent = PASS) and on a fixture store with entries.

| Pattern class | Mechanism | Source |
| --- | --- | --- |
| Size | file >300 lines or over byte cap = FAIL; append that would pass 300 = refused | `check_store.rs:35-37,117-126`; `append.rs:98-107` |
| Injection phrases | ~38 English regexes (instruction override, role reassignment, tool-call hijack, "add this to your memory", jailbreak terms) compiled with JS-compatible `\b \w \s` | `injection_patterns.rs:30-50+` |
| Obfuscation | zero-width strip + NFKC, then decode passes (base64, ROT13, percent-encoding, HTML comments) and a repetitive-padding flood check | `normalize.rs:17-22`; `obfuscation_passes.rs`; `flood.rs` |
| Secrets | credential-shaped regexes, per line and whole-body (PEM blocks) | `scrub_patterns.rs` |
| Scannability | any unreadable path under the store = FAIL, never "clean"; non-directory store = FAIL | `check_store.rs:64-87`; `walk_store.rs` |
| Entry shape | heading + three label lines | `note/shape.rs:43-70` |

### 4.2 What R1 showed (executed, class-level)

R1 item 9 ran `mewkit note` (binary built 2026-11-13, older than main; `validate --memory` not in that binary) and read `normalize.rs` and `injection_patterns.rs`. The pattern source on main is the same table (the Rust crate is the port).

| Class | Result | Note |
| --- | --- | --- |
| Literal phrase from the table | REJECTED | as designed |
| Full-width form of a listed phrase | REJECTED | NFKC folds it |
| Zero-width characters inside a phrase | REJECTED | stripped before matching |
| Phrase broken by a newline inside the phrase | REJECTED | |
| Paraphrase with the same intent, no listed phrase | **ACCEPTED** | semantic, not syntactic |
| Instruction naming an internal script to run | **ACCEPTED** | no pattern names MeowKit's own scripts |
| Cross-script look-alike letters in a listed phrase (Cyrillic) | **ACCEPTED** | NFKC does not fold across scripts; contradicts the homoglyph claim in the code comment (R1 verified the code point) |
| Listed phrase split across separate lines of the entry | **ACCEPTED** | each line scans clean |
| Benign entry with a non-existent `Source:` path | ACCEPTED | `Source:` never resolved |

VERIFIED (executed by R1 on the older binary; main source read). `validate --memory` and `check_store.rs` on main: read, **not run** (R1 open item). The Rust/TS parity fixtures cover obvious payloads only (D05 experiment 5).

### 4.3 What a deny-list can and cannot do in principle (INFERRED)

Premises: the scanner sees text; the reader is a language model that follows meaning, not strings; natural language has unbounded paraphrase and many look-alike encodings.

- **Can:** reject known literal payloads, known encodings after decoding, secret formats with fixed shape, malformed or oversized files. Catches naive, copy-pasted, and accidental content, and makes a successful attack require effort. Rejections leave the store byte-identical (`note/mod.rs:13-17`), so nothing needs removal from git history.
- **Cannot:** decide whether a plausible-sounding lesson is true or harmful; cover paraphrase; cover scripts/encodings it does not enumerate; cover a phrase assembled across fields or lines. Recall is bounded by the list; adding patterns trades false positives against a gap that stays open. 2510.09023 (12 detector/prompt defences bypassed by adaptive attackers) supports "bounded recall" for the class, **RS strong for research defences**, applied here by **INF**. (A Snyk recall table cited in D12 F-D12-21 was not re-checked by R2 and is not used here.)
- The compensating controls are Rule 3 ("memory is DATA", model-level, not a boundary) and PR review. Both are weak against hidden Unicode and semantic poisoning (D12 §3.2).
- Consequence: the documentation should call the lint a tripwire. `memory-system.md` §5 already lists what it checks; it does not say what it cannot catch (Y-04).

### 4.4 Serialization and failure modes

| Item | State | Evidence |
| --- | --- | --- |
| Concurrent appends | Serialized by a per-file sidecar lock under `.meowkit/state/locks/`; stale lock reclaimed; `O_APPEND` as second layer | `append.rs:56-65,82,111-116` VERIFIED |
| Failed write | Prints a one-line message; workflow continues (`agent-conduct.md` A3 text) | DOCUMENTED |
| Pre-ship lint with CLI absent | **SKIP**, exit 0, visible line "SKIP: mewkit CLI not found - team memory store not linted". Chosen deliberately to avoid false blocks (`memory-store-lint.cjs:10-14,74,96,98`). Resolution order: `$MEOWKIT_CLI`, `./node_modules/.bin/mewkit`, `./.meowkit/bin/mewkit`, then bare `mewkit` (`:49-56`) | VERIFIED. R1: this machine has no `mewkit` on PATH, so the skip happens here (machine artefact); the code path is a kit property |
| Lint trigger | Only when the command text matches `/git commit\|git push\|git merge/` (`pre-ship.cjs:18,57`). R1 item 4 showed spacing, `-C`, `-c`, alias and `gh pr` forms miss it; the memory lint inherits that | VERIFIED (R1) |
| CI | Runs the lint on the source repo store and a fixture (`ci.yml:85-99`); does not cover consumer repos | DOCUMENTED |
| Prune | `/mk:memory --prune` is a SKILL.md procedure; no implementation | VERIFIED (D05 F-D05-06; grep on main) |
| Docs drift | `memory-system.md` §5 CLI resolution list omits the `.meowkit/bin/mewkit` launcher branch in code | VERIFIED |

A skip on missing CLI is **fail-open by choice with a named message**; the cost is that a store with an entry can ship unlinted on any machine without the CLI, with the human PR review the only remaining check.

## 5. Read-path correctness

- **Mechanism.** The read is a prose instruction: `grep -rilE "<kw1|kw2|kw3>" .meowkit/memory/`, open matching entries (`memory/SKILL.md` "Read"; five read-set skills plus planner and retro). No hook, CLI verb, or index reads memory. VERIFIED.
- **Failure behaviour.**
  - Directory missing (today's state): `mk:fix` states "skip ... if `.meowkit/memory/` does not exist" (`fix/SKILL.md:93`); the other read-set skills just grep a missing path. Either way: no behavioural difference and no warning. The lint also treats a missing store as PASS (`check_store.rs:22-23,59-62`).
  - Wrong or multi-word keywords: file names only, a silent miss (docs admit multi-word phrases fail; D05 F-D05-03).
  - Quick-mode `mk:fix` skips the grep entirely.
  - Legacy-tree layout (S2): note writes go one place, skills read another (INFERRED, not reproduced).
- **What "memory is DATA" does and does not guarantee.** It is a rule the model reads (`injection-rules.md` Rule 3, `agent-conduct.md`). It does not: sandbox an entry, strip instruction-like text at read time, mark entry provenance, or stop an entry from steering a plan when its `Apply when:` matches many tasks. R2: prompt-level framing is context, not a boundary (**DOC** host memory page; **RS** 2510.09023 for research defences; **INF/UNK** for a 2026 frontier model reading a prose rule). The framing may well reduce harm; nobody measured it.
- **No instrumentation.** Nothing records that an entry was retrieved or changed an outcome (`memory_hit` etc. do not exist; only write flags). So even after the store is populated, benefit, wrong-recall and cost cannot be measured without adding a trace event (Y-09).
- **Cost note (RS, single primary).** Always-on text that does not help costs about +20% tokens (2602.11988). The store is grep-on-demand, so MeowKit avoids that penalty by design; the always-on `rules/` cost is a separate topic (see the context assessment, not this deliverable).

## 6. Staleness

Question: are code-derived memories invalidated when the code changes? **No mechanism exists.** VERIFIED (D05 F-D05-05; prune is prose). An entry with `Source: src/foo.ts` stays "valid" after `foo.ts` is rewritten or deleted. The only automated size/age hygiene is the 300-line cap and a session-start warning when a file passes it (`session-context-report.cjs:168-178`); age is never checked.

Also: `Source:` may be a commit, PR, or a plan/review path. Plans and reviews are archived or untracked (`tasks/reports/` and `tasks/plans/**/*.html` are git-ignored), so "source no longer exists" is under-specified for exactly the sources the skill suggests.

Smallest anchor that would work (INFERRED; Y-06):

| Part | Content | Where |
| --- | --- | --- |
| Write time | `note` requires `Source:` to be a repo path (optionally `path:line`) or a commit SHA, checks it exists, appends `Anchor: <HEAD short sha>` | `note/shape.rs`, `note/mod.rs` |
| Check time (cheap) | Either at `validate --memory` or as a helper the read skills call: for each entry, `git diff --name-only <anchor>..HEAD` intersected with its `Source:` path; flag "source changed since anchor" or "source missing" | new helper beside `check_store.rs` |
| Output | A warning, never a delete. Human decides (consistent with "every removal is human-approved") | |

Cost: one more required label, one git call per entry. Failure mode: shallow clones and rewritten history make the anchor unresolvable; treat unresolvable as "unknown", not "stale". No evidence yet that flagged entries are actually stale more often than unflagged: that is the experiment (section 10B).

## 7. When not to write, when to skip retrieval

Rules the evidence supports. Grade is for the evidence, not for MeowKit's compliance.

| # | Rule | Evidence | Grade |
| --- | --- | --- | --- |
| R-1 | Do not write what the next session can derive from code, git log, plan, ADR | 2602.11988: LLM-generated context that restates the repo gives no success gain and costs more; MeowKit §4 already says this | **RS, single primary** |
| R-2 | Do not write a lesson from a run whose outcome was not verified | 2505.16067 (experience-following; apparently successful trajectories mislead) | **RS** (2025 models) |
| R-3 | Do not write from a turn that consumed fetched or untrusted content without human review | MINJA 2503.03704, AgentPoison 2407.12784: poisoning via ordinary interaction/low poison rate (RAG/long-term memory agents, not coding agents) | **RS, weak** for coding agents; **INF** here |
| R-4 | Do not write secrets or vulnerability detail | MeowKit already excludes (§4); qwen team memory scans before write (`memory/secret-scanner.ts:1-15`, VERIFIED D06) | **INF** (policy) + VERIFIED practice |
| R-5 | Do not write live state (sprint goals, in-progress notes) | `agile-sprint-commitment.md:20` already says use files with contracts; hermes routes knowledge to skills/docs first (D07 F-D07-06) | **INF** |
| R-6 | Skip retrieval when the task is derivable from the code | Unfiltered or wrongly selected context: limited or negative benefit (2602.08316) | **RS, mild** |
| R-7 | Skip an entry whose `Source:` no longer exists, or whose match is lexical but the context differs | 2505.16067 (outputs track retrieved memories when inputs resemble) | **RS** |
| R-8 | Skip retrieval for quick modes and trivial tasks | Extra context costs tokens (2602.11988 +20%; 2510.05381 length alone hurts) | **RS** |
| R-9 | Cap size; prefer fewer, declarative entries | Host 200 lines/25 KB (DOC); hermes 2,200 / 1,375 chars (VERIFIED); MeowKit 300 lines. No study of the right cap | Practice VERIFIED; benefit **UNK** |

Not evidence-supported (do not state as fact): "memory helps on repeat-failure classes" (**HYP**, D05); "180-day expiry" (**HYP**).

## 8. Is Markdown + grep sufficient?

| System | What memory actually is | Retrieval | Write guardrails | Measured benefit |
| --- | --- | --- | --- | --- |
| MeowKit | 2 committed Markdown files, 300-line cap | model-run grep | shape + scan + lock; CLI-gated ship lint | none; store never populated |
| hermes-agent (4b86af50) | `MEMORY.md` 2,200 chars + `USER.md` 1,375 chars, frozen snapshot in the prompt for the session (`memory_tool.py:1-4`) | FTS5 over raw sessions, no LLM (`session_search_tool.py:1-8`); optional single provider plugin, fenced | strict-pattern scan on every write, drift detection with `.bak`, file lock, staged writes pinned to the entry reviewed (VERIFIED D07 F-D07-06) | **none found**; no memory eval under `evals/` (UNKNOWN) |
| qwen-code (9d390e23) | extract / dream / recall / forget, team memory, secret scanner | LLM relevance selector | secret scanner before write | no benefit data; cost knobs held back "until paired runs show..." (`extract-cadence.ts:9-12`, VERIFIED D06) |
| deepseek-harness | none beyond session log + opt-in `session_search` | search | n/a | n/a |
| Literature | structured subtask memory +4.7 pp (2602.21611, self-reported); curated experience helps, unfiltered does not (2602.08316); error propagation (2505.16067) | varies | varies | **No head-to-head of file/grep vs vector/graph memory for coding agents** (D12 F-D12-17) |

Findings:

- The most deployed open agent's memory is *smaller* than MeowKit's concept; the elaboration is in safety (scan, drift, pinning, caps), not in retrieval sophistication. VERIFIED (D07). Benefit UNKNOWN there too.
- No evidence shows grep/Markdown failing for coding-agent memory, and none shows a vector or graph store winning. The store is not populated enough to fail.
- Sufficiency conclusion, in the form the evidence allows: **Markdown + grep is sufficient to start, for a small, human-curated, reviewed store; sufficiency is unmeasured; the insufficiencies that are demonstrated are not retrieval but (a) staleness, (b) syntactic-only write checks, (c) fail-open ship lint, (d) no outcome measurement.** All four are fixable with metadata and checks, not with a retrieval engine.
- **Vector database / embedding store / memory engine: REJECT.** Reason: no demonstrated insufficiency of grep (the one condition under which it would move to DEFER). Re-open only if the section 10C experiment shows retrieval misses (relevant entries exist, grep returns nothing) at a store size above the 300-line cap. If that happens, reclassify to DEFER and prefer FTS over the same files (hermes `session_search` is the precedent) before embeddings.
- hermes-style cheap parts worth borrowing, each EXPERIMENT-gated: hard char caps, write-time scan (MeowKit has), drift/lock (MeowKit has lock), declarative-fact guidance, "skills/docs first, memory narrow exception".

## 9. Agent `memory:` scopes

Maintainer decision as found: 36 of 42 agents set `memory: project` (R1 corrected D03's "21"; 21 is the subset with no Write/Edit in `tools:`). VERIFIED (frontmatter count; the Write/Edit-less count reproduced on main: 21).

| Fact | Evidence |
| --- | --- |
| Host: `memory:` auto-enables Read/Write/Edit so the agent can manage its memory (DOCUMENTED; R2 confirmed, all scopes) | sub-agents page |
| This session's agent list shows `explore` with Write/Edit although its frontmatter lists neither | VERIFIED (R1 11b, live) |
| `athena.md:210` claims "your tools are read-only, so this is structural, not a promise" and `explore.md` says it never writes | CONTRADICTED by the grant (D03 F-D03-04) |
| Stored memory: only `evaluator/` has files on main (3 notes + `MEMORY.md`, 109 lines); five other dirs exist but are empty | VERIFIED `find .claude/agent-memory` |
| Each such agent loads its `MEMORY.md` (200 lines/25 KB) at spawn | DOCUMENTED |
| No eval of agent-memory benefit | UNKNOWN |

Options (maintainer's call; no reversal recommended on cost grounds):

| Option | Effect | Trade-off |
| --- | --- | --- |
| Keep as is | All agents can accumulate project notes | Read-only agents are writable; most stores stay empty; cost paid by the grant, not by memory |
| Drop `memory:` where no store exists | 30+ agents lose the grant; read-only contracts become structural again | Loses the option to learn per agent; reversible per file |
| Scope down | Keep `memory: project` on `evaluator` (and any agent the maintainer wants), and add `disallowedTools: Write, Edit` where read-only is stated | One-line frontmatter change per agent; whether `disallowedTools` overrides the memory grant on this host build is UNKNOWN (D03 open question; experiment E2) |

Security note: a read-only agent that can write is a tool-boundary fact (D03/R1), independent of whether any memory is stored.

## 10. Recommendations

Common to all: affected docs/source cited per row; "Revert" is a git revert of the named files unless stated.

### A. Mechanical correctness fixes

**Y-01 Correct the three doc/code disagreements**

| Field | Content |
| --- | --- |
| Observed problem | `memory-system.md` §8 places subagent memory at `~/.claude/agent-memory/` but agents declare `memory: project`; §5 CLI resolution omits the `.meowkit/bin/mewkit` launcher; `meowkit-rules.md:230` says `.claude/memory/` is not a store while `state_paths.rs:97-112,152-157` can route writes to it |
| Affected source | `docs/core/memory-system.md` (§5, §8), `docs/core/meowkit-rules.md:230` @ `c7ff0a9e` |
| Causal hypothesis | Docs written for the earlier user-scope/npm layout and not updated |
| Proposed change | Edit the three statements to match code |
| Evidence | D05 F-D05-07; section 2/4 above. VERIFIED |
| Alternatives | Do nothing; change code to match docs (rejected: code is the shipped behaviour) |
| Expected benefit | Docs no longer contradict code; readers find the right dir |
| Measurement | Doc-reference check (`validate --docs-refs`-style) or a one-time grep |
| Risks | None |
| Revert | git revert |

**Y-02 Resolve the legacy `.claude/memory/` fallback split**

| Field | Content |
| --- | --- |
| Observed problem | If `.meowkit/memory/` is absent and `.claude/memory/` holds a store file, `note`/lint use the git-ignored legacy dir while every read skill greps `.meowkit/memory/` |
| Affected source | `crates/mewkit-core/src/state_paths.rs:97-112,152-157`; read-set skills |
| Causal hypothesis | Migration shim kept after the move; readers hard-code the new path |
| Proposed change | Option 1: drop the memory fallback (REMOVE on mechanical grounds: split-brain). Option 2: keep it and make the skills' grep use the resolved dir |
| Evidence | D05 F-D05-07. INFERRED (not reproduced); reproduce first with a scratch project |
| Alternatives | Do nothing (affects only pre-move installs) |
| Expected benefit | One store path for read and write |
| Measurement | Test: note + grep round-trip in legacy layout (D05 D6) |
| Risks | A pre-move install with entries in the legacy dir loses them from view; add a one-time warning |
| Revert | git revert |

**Y-03 Make the ship-time lint stop skipping silently when a store exists**

| Field | Content |
| --- | --- |
| Observed problem | `memory-store-lint.cjs` returns SKIP (exit 0) when the CLI is not found, so a store with entries can ship unlinted. The lint also runs only when the command text matches `/git commit\|git push\|git merge/` (`pre-ship.cjs:18,57`) |
| Affected source | `.claude/hooks/lib/memory-store-lint.cjs:74,96,98`; `.claude/hooks/lib/core/pre-ship.cjs:18,57-59` @ `c7ff0a9e` |
| Causal hypothesis | Deliberate: a missing CLI must not read as a poisoned store (`:10-14`). The design did not distinguish "no store" from "store present, cannot lint" |
| Proposed change | If `.meowkit/memory/` (or the legacy dir) is absent: SKIP stays. If present and the CLI is unresolved: exit 2 with a named message ("store present, cannot lint"). Keep CI as the second line |
| Evidence | R1 §8 and D04 F-D04-13; source read. VERIFIED (source); behaviour not run |
| Alternatives | Do nothing (CI covers the source repo only); implement the lint in node (a Rust/JS reader-agreement test already exists per D04, so parity cost is known) |
| Expected benefit | A store entry cannot ship past the hook on a CLI-less machine |
| Measurement | Test: store present + no CLI -> hook exit 2; no store + no CLI -> SKIP |
| Risks | A new block on machines where the CLI is truly unavailable and a store was copied in; message must say how to fix. Not a security control being removed |
| Revert | git revert of the two hook files |

**Y-04 Say what the lint cannot do**

| Field | Content |
| --- | --- |
| Observed problem | `memory-system.md` §5 and `normalize.rs`/`injection_patterns.rs` comments claim homoglyph and obfuscation coverage; cross-script look-alikes, paraphrase and split phrases pass (R1 item 9) |
| Affected source | `docs/core/memory-system.md` §5; `crates/mewkit-core/src/memory/normalize.rs:1-16`; `injection-rules.md` Rule 8 reference |
| Causal hypothesis | "NFKC catches homoglyphs" overstated; NFKC folds compatibility forms, not other scripts |
| Proposed change | Reword the doc and the comment to "tripwire for literal and lightly encoded payloads; not a boundary"; list the classes it does not cover (paraphrase, cross-script look-alikes, split phrases, semantic poisoning) |
| Evidence | R1 item 9 (executed on the older binary); section 4. VERIFIED |
| Alternatives | Add cross-script confusable folding and more patterns (a possible B item; bounded recall remains) |
| Expected benefit | Honest claim; reviewers know PR review is the real control |
| Measurement | Doc review |
| Risks | None; do not publish payload examples |
| Revert | git revert |

**Y-05 Either implement `--prune` or state it is a manual procedure**

| Field | Content |
| --- | --- |
| Observed problem | `append.rs:104-105` and `session-context-report.cjs:177` tell users to run `/mk:memory --prune` as the remedy for a full store; no code implements candidate detection |
| Affected source | `.claude/skills/memory/SKILL.md` "--prune"; `crates/mewkit-core/src/note/append.rs:98-107` |
| Causal hypothesis | The earlier auto-prune hook was removed (`memory-system.md` §9) and replaced by an instruction |
| Proposed change | Smallest: reword the cap message to "edit the store by hand or run the prune procedure in `mk:memory`" and document the procedure as model-guided. Larger (needs the anchor of Y-06): `mewkit memory check` that lists entries whose `Source` path is missing or older than N days; deletion stays human |
| Evidence | D05 F-D05-06; grep on main. VERIFIED |
| Alternatives | Do nothing; leave a model-run procedure (acceptable if stated) |
| Expected benefit | The cap message points to something real |
| Measurement | Cap message review; for the CLI option, a unit test on a fixture store |
| Risks | Larger option adds a CLI verb (more surface) |
| Revert | git revert |

### B. Incremental improvements to the Markdown design (each gated by an experiment)

**Y-06 Anchor entries to a path and a commit** (EXPERIMENT)

| Field | Content |
| --- | --- |
| Observed problem | No staleness check (section 6) |
| Affected source | `note/shape.rs`, `note/mod.rs`, `check_store.rs` |
| Causal hypothesis | Stale advice is the main memory risk; an anchor makes it detectable |
| Proposed change | `Source:` must be a repo path or SHA, existence-checked at write; `note` appends `Anchor: <sha>`; a read-time/validate-time helper flags changed or missing sources as warnings |
| Evidence | F-D05-05 (VERIFIED absent); the benefit is INFERRED; no staleness study found (D12) |
| Alternatives | Age-only prune (current, 180 d, HYPOTHESIS); do nothing |
| Expected benefit | Fewer stale entries consulted |
| Measurement | On a populated fixture: share of flagged entries a human confirms stale; wrong-recall rate with/without flagging |
| Risks | Shallow clones; extra label friction; flags are warnings |
| Revert | Make labels optional again |

**Y-07 Keep caps, add a per-entry size cap and a fixed untrusted wrapper at read** (EXPERIMENT)

| Field | Content |
| --- | --- |
| Observed problem | Entries are only line/byte-capped per file; read-set skills open entries inline with no delimiter |
| Affected source | `note/mod.rs:31`; read-set skill text |
| Causal hypothesis | A smaller declarative entry and a consistent data fence lower the authority of retrieved text |
| Proposed change | Per-entry max (for example hermes-order, a few hundred chars; value to be chosen by the experiment); skills quote entries inside a fixed data marker |
| Evidence | hermes caps and fence (VERIFIED D07); benefit UNK; prompt-level framing is not a boundary (R2) |
| Alternatives | Do nothing |
| Expected benefit | Smaller always-readable surface; clearer data/instruction separation |
| Measurement | Seeded poisoned/stale entries (D12 experiment 4): behaviour change at a gate with vs without wrapper |
| Risks | May hide useful detail; wrapper does not stop a determined payload |
| Revert | Remove the wrapper text |

**Y-08 Extend write-time checks only where a class is demonstrably open** (EXPERIMENT)

| Field | Content |
| --- | --- |
| Observed problem | Cross-script look-alikes and split phrases pass (R1) |
| Affected source | `normalize.rs`, `content_scan.rs` |
| Causal hypothesis | A confusable-skeleton fold and a per-entry (not per-line) join before matching close two named classes |
| Proposed change | Skeleton fold + scan the whole entry as one string for split-phrase classes. Do not add paraphrase patterns (open-ended) |
| Evidence | R1 item 9. VERIFIED classes |
| Alternatives | Y-04 wording only; provenance + human approval at write when the session read untrusted content (D12 D-6) |
| Expected benefit | Two classes closed; recall elsewhere unchanged |
| Measurement | Red-team set with classes (not payload lists) before/after; false-positive rate on real entries |
| Risks | False positives on legitimate multilingual text |
| Revert | git revert |

### C. Experiments for H5 (design in deliverable 12)

**Y-09 Instrument reads, then run a memory A/B** (EXPERIMENT)

| Field | Content |
| --- | --- |
| Observed problem | No evidence memory is consulted or changes outcomes (F-D05-02) |
| Affected source | Read-set skill text; trace events |
| Causal hypothesis | Memory helps only on recurring failure classes; elsewhere it adds cost or noise |
| Proposed change | A trace event `memory_read` with matched entry ids; paired runs on a fixed task set (recurring-bug tasks and unrelated tasks): arms (a) empty store, (b) MeowKit store, (c) hermes-style capped store; plus seeded stale and seeded wrong entries |
| Evidence | D05 D5, D06 D-06-10, D07 experiment 1, D12 D-7. Design is HYPOTHESIS; none run |
| Alternatives | Do nothing: H5 stays UNKNOWN |
| Expected benefit | First measurement of benefit and harm |
| Measurement | Resolve rate, tokens, steps, wrong-recall rate, retrieval hit rate (relevant entry existed vs grep returned it) |
| Risks | Run in a scratch consumer repo (section 2.2 option b) so no memory lands in the shipped tree; 20+ tasks needed for any signal |
| Revert | Remove the event |

Falsifier for this deliverable's conclusions: if arm (b) shows grep missing relevant entries at store sizes under the cap, the sufficiency claim in section 8 fails and the vector/FTS question reopens (REJECT -> DEFER).

### D. Maintainer decisions

**Y-10 Agent `memory:` scope (section 9)** - options keep / drop where unused / scope down. Experiment E2 first: spawn an agent whose frontmatter has `disallowedTools: Write, Edit` and `memory: project`, ask it to write, observe.

**Y-11 Who may write to the team store** - today "any agent" may add a EUREKA entry (`agent-conduct.md` A3) through `mewkit note`, with no human at write time. Options: keep (PR review is the gate); require a human confirmation in the write-set skills when the session read untrusted content (D12 D-6); restrict to named skills. Trade-off: friction vs poisoning surface; evidence for the surface is RS weak (non-coding agents).

**Y-12 The committed-vs-ships-empty tension (section 2.2)** - options a/b/c/d. Recommended pairing (a)+(b) is a suggestion, not a settled change: (c) and (d) reverse an explicit maintainer decision.

## 11. Not covered / open questions

Not covered:
- Rust `validate --memory` and `check_store.rs` were **read, not run** by anyone (R1 open item); `note` was run only on a pre-main binary.
- Whether the release builder honours `pack-manifest.json:36` (declared exclusion only).
- The remaining read-set skill bodies (`mk:retro`, `mk:plan-creator`) and the `analyst` agent beyond grep.
- Codex/Cursor memory behaviour (UNKNOWN, D12), LoCoMo/LongMemEval (not opened), qwen/hermes memory benefit outside their repos.
- Machine artefacts excluded from conclusions: missing `mewkit` on PATH (so SKIP fires here), the untracked LEAN setting, the user-global `~/.claude` toolkit.

Open questions:
1. Does `memory:` override an explicit `tools:` allowlist or a `disallowedTools` entry on the current host build?
2. Is the 300-line cap right for retrieval quality? No study; the host's 200 lines/25 KB and hermes's chars are different units.
3. Is the stale-entry rate high enough to justify Y-06? Unmeasured.
4. Does the legacy fallback ever trigger in a real consumer install (Y-02)?
5. Where is the line between a "non-derivable" lesson and a derivable one when a model decides? No inter-rater data.
6. Citation caveats carried from R2: 2602.11988 venue unverified; 2603.13258 date anomaly (not used); 2602.08316 is a benefit benchmark, not a harm study; MINJA/AgentPoison are not coding-agent studies.
