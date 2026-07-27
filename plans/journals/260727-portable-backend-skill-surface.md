# Portable backend skill surface migration

**Date**: 2026-07-27 11:23
**Severity**: Medium
**Component**: `.claude/skills` (canonical + Codex/Cursor authored bundles), `packages/mewkit` migrate module
**Status**: Resolved (code); release doc changes still uncommitted on top of `e062a40b`

## What Happened

Replaced `mk:api-design` with `mk:api-design-principles` (no alias), added
`mk:backend-development` and `mk:devops`, and rewrote `mk:database` engine-neutral
(`runtime: claude-code` → `portable`). Mirrored into the hand-authored Codex and Cursor
bundles and both `catalog/skill-packs.json`. Added
`packages/mewkit/src/migrate/modules/retired-skill-cleanup.ts` — checksum-gated recursive
delete of an installed skill dir the bundle no longer ships — wired into both provider
reconcilers and `init`/`upgrade`. Committed as `e062a40b` (by the user, not an agent);
release-doc changes (`RELEASING.md`, changelog, version bumps) are staged on top,
uncommitted. Kit stays 2.15.0 (rides the athena release); CLI 2.3.0 → 2.3.1. Final: 273
test files / 2965 tests pass, typecheck clean, lint 0 errors, docs build passes. Counts:
canonical 128, codex 129, cursor 128, exactly 8 reference files across the four skills.

## The Brutal Truth

Every one of the four load-bearing decisions in this migration came from a mechanism
finding a real defect, not from careful upfront authoring. Self-review passed all 14
cold/scenario checks on the first pass — a cold reader immediately couldn't tell which
skill owned three of them. The frontmatter for `mk:backend-development` looked complete
right up until the mechanical scenario check scored it zero on the exact phrase
("authenticated endpoint") the skill exists to own. And a 200-char provider cap almost
forced a choice between contract fidelity and a shipped test before anyone noticed the
canonical text was 50-100 chars over budget. None of these are exotic bugs — they're the
ordinary cost of shipping four adjacent skills that all plausibly fire on the same
prompt. The one that should sting going forward is #4: a manifest `renames: []` sitting
next to a stale `mewkitVersion: "1.14.0"` would have silently no-op'd the exact cleanup
this release was built to ship. That's the kind of miss that doesn't fail loud — it just
quietly leaves `skills/api-design/` on every upgraded machine forever.

## Technical Details

1. **Scenario R2 failed on vocabulary, not logic.** "Add an authenticated endpoint that
   lists a user's orders" was checked by matching prompt vocabulary against all four
   skills' `description` + `when_to_use`. `mk:backend-development` scored 0 — its
   frontmatter had neither "endpoint" nor "authenticated" — so the prompt resolved to
   `mk:api-design-principles` alone. Fix: added that vocabulary to
   `backend-development`'s `when_to_use`, not to the scenario.
2. **Cold read found 3 boundary defects self-review missed.** All 14 C/S scenarios
   passed self-graded. An independent reviewer couldn't attribute ownership for C2
   (extend an existing endpoint), C4 (message-based change), C9 (unscoped "make it
   fast"). Per the content contract, "a cold reader who cannot tell" is itself the
   defect. Fix: rewrote the shared routing block with an explicit rule per case; it's
   now byte-identical (hash-verified) across all four skills.
3. **Locked contract text (271–312 chars) collided with a shipped 200-char cap**
   enforced by `{codex,cursor}-pack-cleanliness.test.ts` (the host silently truncates an
   over-budget catalog entry). Resolution: canonical keeps the contract text verbatim;
   provider projections are trimmed separately — parity of contract, not of bytes.
4. **`portable-manifest.json` renames was `[]`.** `RELEASING.md` step 1d requires a
   `renames` entry for any renamed `.claude/` item. Without it, `mewkit migrate` leaves
   a stale `skills/api-design/` in every upgraded project. Entries only apply when
   `since <= mewkitVersion`, and `mewkitVersion` was stuck at `1.14.0` — had to bump to
   `2.3.1` or the new entry would ship inert. Caught only because step 1d was followed,
   not because anything failed loudly.

## What We Tried

Ran the acceptance scenarios author-self-graded first (per the brainstorm's original
framing) — all passed, which was the wrong signal. Only after the plan's red-team
flagged "acceptance scenarios were author-self-graded" (resolution #4 in `plan.md`) did
R1–R5 get remade mechanical and C/S get a genuine cold reader. That second pass is what
actually found the three defects above.

## Root Cause Analysis

Shipping four skills that all plausibly answer "I'm changing a backend" at once is an
inherently high-collision surface; frontmatter vocabulary and routing prose are the only
disambiguation signal a host has, and neither self-authorship nor self-grading reliably
catches where that signal is thin. The manifest near-miss is unrelated in kind but same
in spirit: a rename is only safe if the metadata that drives cleanup is updated in the
same commit as the content it describes, and nothing enforces that pairing except a
release-doc checklist step someone has to actually read.

## Lessons Learned

- Author-graded acceptance scenarios are close to worthless as a merge gate — the
  content contract's requirement for an independent cold reader on ambiguity-prone
  scenarios (C/S) is doing real work here and should stay non-negotiable for any future
  multi-skill routing change.
- When four skills can plausibly fire on the same prompt, budget for a routing-block
  rewrite pass as a planned step, not a contingency — it happened here, and it's the
  same cost every time this shape of change recurs.
- A provider byte cap that was never load-bearing for content design should be verified
  against the target contract text length *before* writing 271–312 chars of canonical
  description, not discovered by a failing pack-cleanliness test after the fact.
- Any skill/directory rename ships with its manifest `renames` entry and a
  `mewkitVersion` bump in the same commit — treat this as a checklist item that gets
  verified, not assumed, every time (`RELEASING.md` step 1d exists for exactly this and
  is easy to skip past).

## Next Steps

- Release-doc changes on top of `e062a40b` (`RELEASING.md`, changelog, version bumps)
  are still uncommitted — commit them before cutting the athena release.
- Confirm before release whether the pre-existing codex/cursor `rule-advice-supervision`
  asymmetry is intentional codex-only shipping for the athena branch (plan's open
  question 1) — not touched by this migration, but ships alongside it.
- Live model-in-loop routing behavior on Codex or Cursor is not proven — only structural
  parity (counts, frontmatter, hash-identical routing blocks) is verified. Do not claim
  otherwise in release notes.

Deliberate non-changes, recorded so they aren't mistaken for oversights: codex
`budgetReport` keys other than `development` are pre-existing stale drift, left alone;
`SKILLS_INDEX.md` category table already didn't reconcile with its own total (rows sum
92, table says 128) before this change, so it wasn't touched; `satellite-map.json` is a
curated 79-of-128 view, not a live enumeration — it gained no new nodes and kept its
stale `plugin/` `sourceRef` prefix on purpose. A pinned test,
`portable-manifest.test.ts`, asserted `mewkitVersion === one entry's since` — an
invariant that only held with a single-entry manifest. Replaced with an
all-entries-applicable check, negative-control verified before landing.

## Unresolved Questions

- Should the codex/cursor `rule-advice-supervision` asymmetry be normalized before or
  after this release ships? (plan's open question 1, unowned)
- Is a byte-length pre-check for canonical descriptions worth adding to the skill-content
  contract itself, or was this a one-off collision?
