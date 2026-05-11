# Design: `mk:story-sizer` — pre-ticket per-story tech breakdown + sizing

> Brainstorm output. Not a plan, not implemented. EM-grade design for a NEW skill that closes the gap in the `spec-to-pr-walkthrough` workflow at Step 3.5.

## 1. Problem statement

**Current gap (verified across SKILL.md files):**

| Capability | Skill | Pre-ticket? |
|---|---|---|
| Codebase feasibility scan | `mk:scout` + `mk:docs-finder` | yes — but no sizing |
| User-story suggestion | `mk:confluence-spec-analyst`, `mk:intake` | yes — but no sizing |
| Complexity verdict | `mk:jira-evaluator` | NO — requires ticket key |
| Story-point estimate | `mk:jira-estimator` | NO — requires ticket key |
| File-level tech breakdown | `mk:planning-engine review` | NO — requires ticket key |

Every MeowKit skill that emits a complexity verdict, story-point estimate, or file-level tech breakdown **requires a Jira ticket key**. There is no skill that takes a suggested user story (from a spec) and produces sizing before the ticket exists.

**User-stated target flow:**

```
Spec → per-story tech breakdown + estimation → file ticket WITH estimation attached
     → epic + ranking → refinement → planning → implement
```

This flow is currently blocked at the second arrow.

**EM motivation:**

- Catch "this suggested story is actually 3 stories" BEFORE filing the wrong tickets.
- Attach sizing at ticket creation (`mk:jira-issue create --story-points N` — flag verified to exist).
- Keep `mk:jira-estimator` as the authoritative refinement signal at backlog refinement (Step 6 of walkthrough). Pre-ticket sizing is the seed, not the commitment.

## 2. Evaluated approaches

### Approach A — New skill `mk:story-sizer` (SELECTED)

New skill that mirrors the `evaluator + estimator` pair from the Jira side, but reads from spec/intake reports or paste mode. Forks to a new `story-sizer` agent.

**Pros:**
- Clean separation. Mirrors existing naming convention.
- Multi-source input adapter (spec / intake / paste) without bloating any existing skill.
- New agent fork preserves the "single Jira ticket" contract on jira-evaluator/estimator.

**Cons:**
- New surface area to learn.
- Drift risk vs `mk:jira-estimator` if heuristics diverge.

### Approach B — Extend `mk:planning-engine` with `--from-spec`

Add `review --from-spec <report> --story <N>` mode that operates on a Spec Research Report's suggested-story without requiring a ticket key.

**Pros:**
- Reuses existing skill, single planning surface.

**Cons:**
- Violates `mk:planning-engine`'s declared contract (`argument-hint: "review PROJ-123"`).
- Bloats a skill whose value is anchored Jira analysis.
- Doesn't address intake or paste inputs.

### Approach C — Extend `mk:confluence-spec-analyst` with `## Sizing Hints`

Add a sizing section to the Spec Research Report output.

**Pros:**
- Zero new commands.

**Cons:**
- Only Confluence-derived stories get sizing. Intake reports and paste mode left out.
- Couples sizing to spec analysis. Re-running sizing after refinement forces re-running spec analysis.

**User selection: Approach A — `mk:story-sizer`.**

## 3. Final design

### 3.1 Skill metadata

```yaml
---
name: mk:story-sizer
description: "Heuristic complexity verdict + story-point sizing for pre-ticket user stories. Reads from Spec Research Report, intake report, or paste. Default: read-only — emits a Story Sizing Report with SUGGESTED `mk:jira-issue create` commands. Opt-in `--auto-create` flag delegates ticket creation to `mk:jira-issue` and `mk:jira-collaborate` with MANDATORY batch dry-run and single confirmation gate. Triggers: 'size these stories', 'rough-size from spec', 'pre-ticket sizing', 'create tickets from spec sizing'. NOT for sized Jira tickets (mk:jira-evaluator / mk:jira-estimator); NOT for sprint planning (mk:planning-engine)."
phase: on-demand
source: local
keywords: [story-sizer, pre-ticket-sizing, story-points, spec-to-sprint, fibonacci-estimation, split-recommendation, auto-create-gated]
when_to_use: "Use to rough-size suggested user stories BEFORE Jira tickets exist. Default mode is read-only (advisory). Opt-in `--auto-create` mode delegates ticket creation to existing Jira skills with mandatory dry-run + batch confirmation. NOT a commitment — `mk:jira-estimator` remains authoritative once tickets exist and refinement happens. NOT for sized Jira tickets (use mk:jira-evaluator / mk:jira-estimator)."
user-invocable: true
agent: story-sizer
context: fork
---
```

### 3.2 Commands

| Command | What it does |
|---|---|
| `--from-spec <report-path>` | Read `## Suggested User Stories` section from a `mk:confluence-spec-analyst` Spec Research Report |
| `--from-intake <report-path>` | Read suggested stories / requirements from an `mk:intake` report |
| `--paste` | Interactive paste mode — user pastes a markdown block of stories with ACs |
| `--scout` | Optional — adds codebase context via `mk:scout`. Matches `mk:planning-engine`'s `--scout` pattern. Default: text-only sizing |
| `--story <id>` | Optional — size a single story by its ID (e.g. "Story A") instead of all |
| `--auto-create --project <KEY> [--epic <KEY>]` | **Opt-in.** After sizing, render dry-run batch table → batch confirmation prompt → on YES, delegate ticket creation per story to `mk:jira-issue create --story-points <N>`, then follow up with `mk:jira-collaborate add-comment <KEY> "<audit-comment>"`. Two delegated calls per ticket. Default OFF |

### 3.3 Output contract — Story Sizing Report

Written to `tasks/reports/story-sizing-{YYMMDD}-{slug}.md` (matches the path convention `mk:planning-engine` uses when no active plan exists).

```markdown
# Story Sizing Report — Q3 Auth Refresh
> Source: tasks/reports/spec-research-260511-q3-auth-refresh.md (hash: a3f8...)
> Scout context: yes (architecture cached from prior run)
> Generated: 2026-05-11 01:48

## Story A: "Sign in with Google OAuth"
- Source: §Story A (R1, R2, AC1, AC2)
- Complexity: standard
- Inconsistencies: none
- DoR (if Agile context active): complete
- Tech breakdown:
  - 1 new file (`src/auth/oauth-google.service.ts`)
  - 2 modified files (`oauth.controller.ts`, `auth.module.ts`)
  - 0 schema changes
- Codebase signals: HIGH feasibility (plugin pattern exists)
- Rough sizing: **3 points** (uncertainty ±1)
- Split recommendation: KEEP — appropriately sized
- Suggested Jira create:
  ```bash
  /mk:jira-issue create --project AUTH --type Story \
    --summary "Sign in with Google OAuth" \
    --story-points 3 \
    --description "..." \
    --epic AUTH-200
  ```

## Story B: "User profile management with settings, preferences, and billing"
- Complexity: complex
- Inconsistencies: 2 (story mixes 3 concerns)
- Rough sizing: **13 points — consider splitting**
- Optional split proposal:
  - "Profile settings (name, avatar)" — ~3 points
  - "Notification preferences" — ~2 points
  - "Billing tab UI" — ~5 points
- Suggested Jira create (unsplit, if you choose to keep it):
  ```bash
  /mk:jira-issue create --project AUTH --type Story \
    --summary "User profile management" \
    --story-points 13 \
    --description "..."
  ```
```

### 3.3a Auto-create dry-run format (with `--auto-create`)

Before any ticket is created, the skill renders the entire batch as a markdown table and asks for **one** confirmation:

```
Tickets to create (dry-run):

| # | Summary                       | Type  | Points | Epic     | Notes              |
|---|-------------------------------|-------|--------|----------|--------------------|
| 1 | Sign in with Google           | Story | 3      | AUTH-200 | —                  |
| 2 | Sliding 24h session expiry    | Story | 5      | AUTH-200 | Blocks #1          |
| 3 | Preserve email/password flow  | Task  | 2      | AUTH-200 | —                  |
| 4 | User profile management       | Story | 13     | AUTH-200 | **SPLIT SUGGESTED** |

Source: tasks/reports/spec-research-260511-q3-auth-refresh.md (hash a3f8...)
Scout: yes — feasibility HIGH for all four
Existing-ticket duplicate check (mk:jira-search): 0 matches

Per-ticket plan:
  For each ticket:
    1. mk:jira-issue create --project AUTH --type <Type> --summary "..."
       --story-points <N> --epic AUTH-200 [--blocks ...]
    2. mk:jira-collaborate add-comment <KEY>
       "Initial sizing from mk:story-sizer: <N> points (heuristic).
        Source spec: spec-research-260511-q3-auth-refresh.md §<Story-ID>.
        Pending team refinement via mk:jira-estimator."

Confirm batch creation? [Y/n]
```

**Gate semantics:**

- **One confirmation, batch-level.** User picks Y or n once for the entire batch. No per-ticket prompt in the happy path.
- **Auto-abort triggers** — the skill REFUSES to enter the dry-run table if ANY of these are true; user must intervene first:
  - Any story has `[NO_ACS]` flag
  - Any suggested summary contains an injection pattern (`ignore previous instructions`, `you are now`, `disregard your rules` — per `injection-rules.md` Rule 1 patterns)
  - `mk:jira-search` returns a fuzzy-match for an existing ticket summary → flagged as `DUPLICATE_SUSPECT`
  - Source spec hash mismatches the report's recorded hash (spec changed between sizing run and ticket-create run)
- **Split-suggested rows** are surfaced in the table with the `SPLIT SUGGESTED` marker but DON'T block confirmation — preserves "advisory split" from the prior Q&A.
- **No `--auto-confirm`/`--yes` flag.** The confirmation is the one human gate the auto-create path preserves. There is no escape hatch by design.

### 3.3b Per-ticket execution (after confirmation)

For each story in the confirmed batch, in declaration order:

```
For story <ID>:
  Call A — mk:jira-issue create --project <KEY> --type <Type>
           --summary "..." --story-points <N> --epic <KEY>
           [--blocks <prior-key>]
    → returns NEW-KEY
  Call B — mk:jira-collaborate add-comment <NEW-KEY>
           "Initial sizing from mk:story-sizer: <N> points (heuristic).
            Source: <report-path> §<story-id>.
            Pending team refinement via mk:jira-estimator."
    → footer comment (NOT inline — per mk:jira-collaborate safety convention)
  Record: <NEW-KEY> → <story-id> mapping in tasks/reports/story-sizing-<date>-<slug>.md
    under a new ## Created Tickets section appended after sizing details
```

**Failure handling:**
- Call A fails (e.g. custom-field validation) → STOP batch. Report partial progress. Do NOT roll back already-created tickets — they're real, dev must manually decide.
- Call B fails (Call A already succeeded) → log warning, continue to next story. Comment can be added by hand later. Ticket field-history still shows the point.
- Network or auth failure → STOP, surface the error from `jira-as`.

### 3.4 Decision matrix (locked by brainstorm Q&A)

| Decision | Choice | Rationale |
|---|---|---|
| Sizing scale | Fibonacci 1/2/3/5/8/13 | Drops straight into `--story-points` flag with no conversion |
| Split policy | Advisory for 13+ | Surfaces split proposal but still emits unsplit create command — preserves "AI provides signals, humans decide" |
| Codebase context | Optional `--scout` flag | Matches `mk:planning-engine`'s pattern; users opt in for accuracy or skip for speed |
| Auto-create path | Opt-in `--auto-create` (off by default) | Default mode is fully advisory; auto-create is gated by `--auto-create` AND batch confirmation. Two-step opt-in prevents accidents |
| Dry-run shape | Single markdown table, batch confirmation | Best ergonomics-to-safety ratio: one prompt covers N tickets; user sees all consequences at once |
| Estimate location in Jira | `--story-points` field at creation + audit comment after | Field carries the value (Jira reports work); comment documents AI authorship for retro audits |

### 3.5 Position in the `spec-to-pr-walkthrough` flow

Inserts **between current Step 3 and Step 4**:

| # | Step | Skills |
|---|---|---|
| 1 | Pull spec | `mk:confluence-spec-analyst` |
| 2 | Resolve gaps with PM | `mk:confluence-collaborate` |
| 3 | Codebase feasibility scan | `mk:scout` + `mk:docs-finder` |
| **3.5** | **Story sizing (NEW)** | **`mk:story-sizer --from-spec ... --scout`** |
| 4 | Create tickets WITH `--story-points` from Step 3.5 | `mk:jira-issue create` |
| 5 | Group into epic + rank | `mk:jira-agile`, `mk:jira-relationships` |
| 6 | Refine + estimate (authoritative) | `mk:jira-evaluator`, `mk:jira-estimator` |
| 7 | Tech review against codebase | `mk:planning-engine` |
| 8 | Plan per ticket | `mk:plan-creator` |
| 9 | Implement | `/mk:cook` |
| 10 | After merge close-loop | `mk:jira-lifecycle` + `mk:confluence-collaborate` |

(Or renumber Step 3.5 → Step 4, shift everything else by one. Naming TBD during implementation plan.)

### 3.6 Agent design

New agent at `.claude/agents/story-sizer.md`. Fork pattern (matches `confluence-spec-analyst` agent).

**Capabilities:**
- Read input adapter output (parsed stories with ACs).
- Read scout output if provided.
- Apply heuristics:
  - Inconsistency check (story description vs ACs vs source spec).
  - Complexity drivers: integration count, novelty, code volume estimate, AC count, codebase touch breadth.
  - DoR advisory (if Agile context active, per `agile-story-gates.md`).
  - Fibonacci mapping from complexity drivers.
  - Split detection: stories with >8 drivers OR >2 distinct concerns OR uncertainty > ±3.
- Emit Story Sizing Report.

**Privileges:**

- **Default mode:** Read, Grep, Glob, Bash (git only). Write to `tasks/reports/story-sizing-*.md` only.
- **`--auto-create` mode:** SKILL.md-level orchestration spawns `mk:jira-issue create` and `mk:jira-collaborate add-comment` as delegated skills. The `story-sizer` agent itself does NOT touch Jira credentials, does NOT call the Atlassian API directly. Delegated skills carry their own injection-rules.md compliance (the existing jira-as wrapper handles auth and content-as-DATA boundaries).
- This delegation pattern mirrors `mk:planning-engine`'s use of `mk:scout` and `mk:jira-issue` — skill-to-skill orchestration is allowed when the parent skill stays at the SKILL.md level and does NOT invoke other skills from inside a subagent.

### 3.7 References (shared with existing skills)

- `.claude/skills/jira/references/estimation-guide.md` — reuse Fibonacci heuristic rules
- `.claude/skills/jira-evaluator/references/` — reuse complexity-dimension scoring approach
- `.claude/rules-conditional/agile-story-gates.md` — conditional DoR check
- New: `.claude/skills/story-sizer/references/input-adapters.md` — spec / intake / paste parsing rules
- New: `.claude/skills/story-sizer/references/split-heuristics.md` — when-to-recommend-split rules
- New: `.claude/skills/story-sizer/assets/sizing-report-template.md` — output skeleton

## 4. Implementation considerations & risks

### 4.1 Skill Rule of Two compliance

Per `injection-rules.md` Rule 11, a skill must not satisfy all 3 of: process untrusted input + access sensitive data + change state.

| Property | Default (advisory) mode | `--auto-create` mode |
|---|---|---|
| [A] Process untrusted input (spec/intake/paste) | YES | YES |
| [B] Access sensitive data (Jira creds, env vars) | NO — no env reads, no API calls | NO — credentials live inside `jira-as` wrapper invoked by delegated `mk:jira-issue` / `mk:jira-collaborate` skills. Story-sizer never sees them. |
| [C] Change state (Jira tickets, repo, memory) | NO — writes one local report file | YES — orchestrates ticket creation via delegated skills |
| **Total** | **1 of 3 — SAFE** | **2 of 3 — SAFE (still under Rule 11 threshold)** |

**Critical nuance for `--auto-create`:** the skill stays 2-of-3 *only because credentials are kept in the `jira-as` wrapper*. If a future refactor moved credential handling into story-sizer's own code path, it would flip to 3-of-3 and be REJECTED. The delegation pattern is load-bearing.

### 4.1a Auto-create injection defense (specific to `--auto-create`)

The spec content driving auto-create is untrusted DATA. Story-sizer MUST sanitize before passing to delegated skills:

| Defense | What it checks |
|---|---|
| Pattern reject | Suggested summary or description contains `injection-rules.md` Rule 1 patterns (`ignore previous instructions`, `you are now`, `disregard your rules`, `pretend you are`, etc.) → ABORT batch, surface the quoted offending string |
| Length cap | Summary > 255 chars or description > 5000 chars → REJECT (also catches "context-flooding" injection per Rule 9) |
| Field whitelist | Only `--type`, `--summary`, `--description`, `--story-points`, `--epic`, `--blocks`, `--components`, `--labels` flags emitted. No `--custom-fields`, no `--assignee`, no `--priority`. Reduces attack surface |
| Duplicate suspect | `mk:jira-search` lookup of the suggested summary; fuzzy match → flag, require human override per ticket via a second AskUserQuestion |
| Hash-match abort | Source spec hash recorded at sizing time; auto-create re-reads the spec and re-hashes. Mismatch → ABORT, prompt re-run of sizing first |

### 4.2 Drift risk vs `mk:jira-estimator`

If story-sizer says "3 points" and jira-estimator says "5 points" after the ticket is filed and refined, which wins?

**Answer (built into the design):**
- Output explicitly labels rough sizing as a SEED, not a commitment.
- The Story Sizing Report header includes: `> This is heuristic sizing for ticket creation and split decisions. mk:jira-estimator is authoritative once the ticket exists.`
- No automatic propagation: dev manually copies the number into `--story-points` at create time.
- Team can compare pre vs post sizing in retros as a calibration signal.

### 4.3 Input adapter validation

Each input source needs format validation. If the source doesn't have ACs per story, the skill MUST refuse to size (output: `[NO_ACS — sizing requires acceptance criteria]`).

- Spec Research Report: validates `## Suggested User Stories` section exists and each story has linked ACs.
- Intake report: validates the report has a "Technical Assessment" or equivalent section.
- Paste mode: explicit format prompt — story + ACs structure.

This mirrors `mk:planning-engine`'s `--spec` validation (rejects malformed input with a prompt-then-exit).

### 4.4 Multi-source adapter — three parsers

Adds maintenance cost. Mitigated by:
- Each adapter is small (~50 lines), confined to `references/input-adapters.md`.
- Validation step is shared; only the section-extraction differs per source.
- Paste mode is the fallback — if a new source format appears, paste mode handles it without new adapter code.

### 4.5 Story-changed-after-sizing drift

If you size on Monday and the spec is edited Tuesday, sizing may be stale.

**Mitigation (built into the design):**
- Source page hash recorded in the report header.
- On re-run, story-sizer detects hash mismatch and warns: `Source spec hash changed since last sizing. Recommend re-run.`

## 5. Success metrics

| Metric | Target | How measured |
|---|---|---|
| Tickets filed with `--story-points` at creation | >80% of tickets created from spec workflow | Audit `mk:jira-issue create` calls — were they emitted by story-sizer's suggested commands? |
| Tickets requiring story-point change after refinement | <30% delta from pre-ticket sizing | Compare pre-ticket size to post-refinement `mk:jira-estimator` output |
| Stories caught for splitting before tickets are filed | At least 1 per sprint | Count `consider splitting` recommendations that resulted in multiple tickets vs one |
| False-positive splits | <20% | Stories flagged for split that the human chose to keep unsplit |
| Time to size a 5-story spec | <2 min without `--scout`, <5 min with `--scout` | Wall-clock on a representative spec |

## 6. Next steps & dependencies

### 6.1 Build order

1. **References + assets** — write `input-adapters.md`, `split-heuristics.md`, `sizing-report-template.md`. ~300 LOC markdown.
2. **Agent** — `.claude/agents/story-sizer.md`. ~80 lines.
3. **Skill** — `.claude/skills/story-sizer/SKILL.md` + frontmatter. ~120 lines.
4. **Workflow integration** — update `website/workflows/spec-to-pr-walkthrough.md` to insert Step 3.5 (or renumber 3.5 → 4, etc.).
5. **Skill index** — add row in `.claude/agents/SKILLS_INDEX.md`.
6. **VitePress** — add `website/reference/skills/story-sizer.md` (under 800 lines per `docs.maxLoc`).
7. **VitePress config** — add to sidebar under reference/skills.
8. **Changelog** — add to v2.8.8 changelog entry (or next minor).
9. **Validation** — calibration set: run story-sizer on 3-5 historical specs, compare sizing to actual filed tickets' final story points. Target <30% drift.

### 6.2 Dependencies

| Depends on | Reason | Status |
|---|---|---|
| `mk:confluence-spec-analyst` | Default input source | Exists (v2.8.4) |
| `mk:intake` | Alternate input source | Exists |
| `mk:scout` | Optional codebase context | Exists |
| `mk:jira-issue create --story-points` | Output handoff | Exists (verified in jira-issue agent) |
| `agile-story-gates.md` | DoR advisory | Exists (v2.8.7) |
| `.claude/skills/jira/references/estimation-guide.md` | Reused heuristics | Exists |

**Zero new infrastructure needed. All dependencies already in MeowKit.**

### 6.3 Out of scope (explicit)

- Default mode does NOT create Jira tickets. Suggested create commands are emitted, dev runs by hand.
- `--auto-create` mode DELEGATES creation but does NOT auto-confirm. Batch confirmation prompt is mandatory; no `--yes`/`--auto-confirm` flag exists by design.
- NOT touching `mk:jira-estimator`. Two skills coexist with explicit non-authoritative / authoritative contract; `--auto-create`'s field-set is still a heuristic seed that refinement supersedes.
- NOT auto-resolving inline comments, NOT setting `--assignee`, NOT setting `--priority`. Field whitelist enforced.
- NOT batching across multiple specs. One spec/intake/paste → one report → one batch of tickets.
- NOT diffing pre-ticket size vs post-ticket estimate automatically. Manual retro tool, can be added later.
- NOT auto-rolling-back tickets created before a mid-batch failure. Manual cleanup; partial-progress recorded in the report.

## 7. Unresolved questions

1. **Step number in `spec-to-pr-walkthrough`** — insert as Step 3.5 (preserves existing numbering), OR renumber as Step 4 (shifts everything else by one)? Smaller diff favors 3.5; cleaner numbering favors renumber.
2. **Paste-mode UX** — interactive prompt asks "paste your stories as markdown bullets" — but how strict is the format? Strict format helps the parser; loose format helps the human. Suggest a middle ground: required keys (`story:`, `ac:`), tolerant whitespace.
3. **Should story-sizer write into `tasks/reports/` or a new `tasks/sizings/` directory?** — Consistency with planning-engine says `tasks/reports/`. Cleaner separation says new dir. Default to `tasks/reports/` per existing convention.
4. **Calibration set** — does the team have 3-5 historical specs+tickets for the v1 calibration set, or do we ship without baseline?
5. **`mk:plan-creator` integration** — should plan-creator at Step 8 of the walkthrough auto-discover and cite the Story Sizing Report (in addition to the Tech Review Report)? Or keep that handoff manual as we discussed earlier?
6. **Auto-create + `mk:jira-relationships` (blocks/depends-on) links** — sizing produces ordering hints (Story B blocks Story A). Should `--auto-create` ALSO call `mk:jira-relationships link <A> blocks <B>` after creation, or stop at create+comment and let dev link by hand? Each extra delegated call expands the failure surface.
7. **Audit comment wording** — proposed: *"Initial sizing from mk:story-sizer: N points (heuristic). Source: <report> §<id>. Pending team refinement via mk:jira-estimator."* — Does this match the team's existing audit convention or should it be customizable via `MEOW_STORY_SIZER_COMMENT_TEMPLATE` env var?
8. **Sprint assignment** — `mk:jira-issue create` accepts `--sprint`. Should `--auto-create` allow `--sprint <N>` to auto-add to a sprint at creation time? My recommendation: NO — sprint commit is a planning-poker decision. But worth confirming.
