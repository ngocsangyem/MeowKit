# SubagentStart — spike decision record

## Verdict: `adopt`

**Date: 2026-11-09.** `adopt` here means exactly what the contract defines it to mean: **the
blanket "it infinite-loops" claim is corrected, and a throttled injector becomes a future
candidate.** It does **not** mean an injector ships. Nothing is registered by this change:
`.claude/settings.json`'s `"SubagentStart"` array is still `[]` (`:162`), no handler file exists
anywhere under `.claude/hooks/`, and no always-on rule was shortened on the strength of this
answer.

## Retrieval chain (mk:docs-finder: Context7 → Context Hub → WebSearch)

Attempted in order on **2026-11-09**, all via the `mk:docs-finder` scripts:

| Step | Command | Result |
|---|---|---|
| 1. Context7 | `node .claude/skills/docs-finder/scripts/fetch-context7.js "claude code hooks reference"` | `success: false` — `Documentation not found for "claude-code-hooks-reference" on context7.com`; tried `https://context7.com/websites/claude-code-hooks-reference/llms.txt`. A retry with the query `"claude code"` failed the same way. |
| 2. Context Hub | `node .claude/skills/docs-finder/scripts/fetch-chub.js "claude code hooks"` | `success: false` — `Context Hub (@aisuite/chub) is not available`. |
| 3. Tier-4 fallback | `node .claude/skills/docs-finder/scripts/fetch-web-to-markdown.js "https://docs.claude.com/en/docs/claude-code/hooks"` → delegated to `mk:web-to-markdown` | Reached the page. **Succeeded**, with one handling note below. |

**The reference DOES enumerate `SubagentStart`**, so this record is not the
documentation-absence branch. It is cited, dated, and the retrieval chain above is recorded
because two of its three legs returned nothing and that is worth knowing next time.

### Two honest notes on step 3

1. **An injection STOP fired, and was handled as a STOP.** `mk:web-to-markdown`'s detector
   refused to return the page body: `INJECTION_STOP: page at
   https://docs.claude.com/en/docs/claude-code/hooks contains instruction-override patterns`,
   quarantining it at `.meowkit/cache/web-fetches/quarantine/295067405a6a9bf1.quarantined`
   (1 332 328 B) with "Manual review required. No programmatic bypass." That is the expected
   false-positive class for a page that *documents* hooks and necessarily contains strings about
   prompts and overriding behaviour. The bypass was **not** used. Instead the quarantine file was
   read by bounded extraction only — event-name enumeration and the handful of sentences quoted
   below — and nothing in it was treated as an instruction. Every fact below is DATA extracted
   from a vendor page.
2. **A pre-existing script defect was worked around, not fixed here.**
   `.claude/skills/web-to-markdown/scripts/fetch_as_markdown.py:37` does
   `from scripts.html_to_markdown import …`, which raises `ModuleNotFoundError: No module named
   'scripts'` unless the skill directory is on `PYTHONPATH`. The retrieval was completed with
   `PYTHONPATH=<skill dir>` set on the invocation. This is unrelated to the metadata work and is
   out of scope; it is recorded here as a follow-up rather than patched mid-sprint.

## What the reference actually says

Extracted verbatim from the quarantined page (DATA, quoted for citation):

- `SubagentStart` "Runs when Claude spawns a subagent with the Agent tool, when Claude resumes a
  subagent, and **each time an in-process agent team teammate handles a new message**. Supports
  matchers to filter by agent type name."
- "`SubagentStart` hooks **can't block subagent creation**, but they **can inject context into the
  subagent**."
- In the output-capability table, `SessionStart, SubagentStart, PostModelSwitch` are grouped as
  **"Context only"** via `hookSpecificOutput`.
- In the blocking table, the `SubagentStart` row reads **can-block: "No"**, and
  "Shows stderr to user only" — and a non-blocking error "appears in the subagent's own
  transcript, not in the parent conversation".
- It is grouped with `SessionStart` as firing "at the start of the conversation, before the first
  prompt".
- A dedicated `#subagentstart` section and a `SubagentStart input` subsection exist, so the event
  is a first-class documented surface, not an undocumented internal.

Searching the same page for `recursi`, `infinite loop` and `nested subagent` returns **no**
statement that the event loops. The only `recursi` hit is an unrelated code sample
(`"List files recursively"`).

## Why that is `adopt` and not `reject`

The in-tree claim being tested was a **blanket** one: that wiring the event "would cause infinite
recursion inside subagents". Three independent readings now contradict it.

1. **The documented firing model is per-spawn, not per-turn.** A hook that runs once when a
   subagent is created, grouped with `SessionStart`, is not a loop. The recursion story only works
   if the hook itself caused another spawn, and a context-injection-only hook that cannot block
   creation has no mechanism to do so.
2. **The kit's own cited evidence never supported the claim either way.** The claude provider
   record at `packages/mewkit/src/core/provider-lifecycle.ts:82-86` asserted
   `subagent_start: status "supported"` on the evidence string "SubagentStart hook in shipped
   settings.json (observe)" — and that registration, `.claude/settings.json:162`, is `[]`. An empty
   array is not evidence of support. So the tree held a "supported" record justified by nothing and
   six prose sites asserting the opposite; neither side was measured.
3. **Host observation, qualified.** The one host observation carried forward from the previous
   sprint — a third-party `SubagentStart` hook firing once into a sub-agent context — is
   **existence evidence only, not throttling evidence**, and is cited here only as such. It shows
   the event reaches a subagent; it says nothing about frequency or cost at scale. Separately, this
   sprint's own `claude -p` runs reported a `subagent_stats` object carrying `max_depth` and
   `refused.depth_limit` counters, which is consistent with the host bounding subagent depth
   itself — again existence of a bound, not a measurement of one.

## The real concern, which replaces the wrong one

The reference names a genuine repetition surface that "infinite recursion" obscured: on
**in-process agent teams** the event fires **each time a teammate handles a new message**, not
once per teammate. An unthrottled injector would therefore re-inject on every message in a
long-running team session. That is a cost and noise problem with a bounded blast radius, and it is
the design question a future injector has to answer — not a correctness impossibility.

## Relationship to the claude provider record

`packages/mewkit/src/core/provider-lifecycle.ts`'s `subagent_start` record is **superseded in its
evidence, confirmed in its status.**

- `status: "supported"` **stands** — it is a statement about the host, and the host documents the
  event.
- `gate: false` **stands**, and is now independently corroborated: the reference's own blocking
  table says the event cannot block.
- `evidence: "SubagentStart hook in shipped settings.json (observe)"` is **replaced**, because it
  cited an empty array. Its replacement cites the host documentation with its retrieval date and
  states that this kit registers no handler, so no in-repo proof exists and none is claimed.

The codex record for the same event is a different harness and is secondary; it is not touched by
this verdict.

## Sites updated with this verdict

All six, so the tree holds one answer rather than two:

| Site | Change |
|---|---|
| `.claude/skills/cook/references/orchestration-rules.md` (capability table) | Blanket "hooks fire inside subagents and infinite-loop" withdrawn; per-harness question retained. |
| `.claude/skills/cook/references/orchestration-rules.md` (Rejected Patterns) | Row kept — the pattern genuinely is not implemented — with the reason corrected to a deliberate deferral pending a throttle. |
| `docs/architecture/context-isolation.md` ("Critical constraint") | "Would cause infinite recursion" marked superseded; the empty hooks restated as a choice. |
| `docs/architecture/context-isolation.md` (Rejected Patterns) | "Infinite-loop — documented platform constraint" replaced with "deferred, not impossible". |
| `docs/core/meowkit-architecture.md` | "Intentionally empty" kept, with the loop rationale superseded and dated. |
| `docs/reference/sub-agents.md` | This page is a mirrored vendor reference and was **correct**; rather than altering mirrored text, a marked project note after the `SubagentStart`/`SubagentStop` table carries the verdict and states that the registration example is host documentation, not kit configuration. |

`docs/architecture/` is architect-owned. The edits there are the minimum the signed criterion
requires — one superseded-claim line and one table cell — and they state a verdict rather than
introducing architecture. Flagging it so the ownership exception is visible rather than silent.

## What ships: nothing

- `.claude/settings.json` `"SubagentStart": []` — unchanged, still empty.
- No file under `.claude/hooks/` mentions `SubagentStart` (`git grep -l SubagentStart --
  .claude/hooks` → no output).
- No file under `.claude/rules/` was touched.
