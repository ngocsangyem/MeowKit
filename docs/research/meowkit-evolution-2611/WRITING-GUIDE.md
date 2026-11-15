# Deliverable writing guide

For agents compiling a deliverable from the findings files. You are a compiler and editor, not
a new researcher: every statement must trace to a finding ID in `findings/` or to
`evidence-ledger.md`. If you need a fact that is not there, verify it yourself in source and
label it, or write UNKNOWN. `BRIEF.md` constraints still apply (read-only on the repo; write
only your deliverable file).

## Baseline

`main` @ `c7ff0a9e` is the baseline. `fc278b31` is an ancestor; a claim that only holds there
must say so. On main the TypeScript CLI is retired; Rust `mewkit` is the only CLI.

## Precedence between sources

1. `findings/R1-critical-review-source-claims.md` overrides D01–D05 wherever they differ
   (verdicts CONFIRMED / WEAKENED / REFUTED / UNVERIFIABLE). Carry R1's verdict into the text.
2. `findings/R2-critical-review-citations.md` (when present) overrides D08–D12 on what a
   citation says. A citation R2 marks NOT FOUND or MISATTRIBUTED must not appear as support.
3. `evidence-ledger.md` L-items are lead-verified.
4. Where two auditors disagree and no reviewer resolved it, present both and mark it open.

## Three separations every deliverable must keep

- **Kit property vs machine artefact.** Findings caused by this machine (untracked
  `.claude/settings.local.json` exporting `MEOWKIT_AUTOBUILD_MODE=LEAN`, the user-global
  `~/.claude` toolkit, the Vercel plugin, missing `mewkit` on PATH, missing `node_modules`,
  the name-only skill listing) are not properties of the shipped kit. Put them in their own
  section.
- **Discovery vs documented design limit.** The maintainer has already documented some limits
  (the approval receipt is "agent-writable by design … anti-accidental, not unforgeable"; Codex
  is "experimental", bundle checks are "structural parity"). Restating one is not a finding.
  Say what is new beyond the documented limit, if anything.
- **No evidence of benefit vs evidence of no benefit.** The repo has no outcome measurements
  at all. So "REMOVE X because unproven" is not justified by itself. A removal needs either a
  mechanical reason (unwired, unreachable, duplicated byte-for-byte, contradicted by its own
  docs) or a named experiment first. Classify accordingly: REMOVE only on mechanical grounds;
  otherwise EXPERIMENT or NEEDS MORE EVIDENCE.

## Maintainer decisions

Do not present the reversal of an explicit maintainer design decision as a settled
recommendation. State the decision as found, the evidence against it, the trade-off, and the
options (keep / change / hybrid). Security controls are never recommended for removal on cost
grounds alone.

## Decision vocabulary

KEEP · SIMPLIFY · REMOVE · DELEGATE TO HOST · IMPROVE · EXPERIMENT · DEFER · REJECT ·
NEEDS MORE EVIDENCE.

## Recommendation template (use for every proposed change)

| Field | Content |
| --- | --- |
| Observed problem | what, concretely |
| Affected source | `path:line` @ commit |
| Causal hypothesis | why it happens |
| Proposed change | smallest change that addresses it |
| Evidence | finding IDs + label (VERIFIED / DOCUMENTED / …) |
| Alternatives | incl. "do nothing" and "delegate to host" |
| Expected benefit | specific |
| Measurement | how we would know it worked |
| Risks | incl. security impact |
| Revert | how to undo |

No vague recommendations ("improve performance", "simplify the architecture").

## The 14-question decision framework (from the research directive)

Use exactly these when a deliverable says "apply the decision framework":

1. What exact problem exists?
2. Where is it demonstrated in source code?
3. What is the observed impact?
4. What alternative explanations exist?
5. What evidence supports the diagnosis?
6. Can the host already solve it?
7. Can an existing MeowKit component solve it?
8. Can the mechanism be simplified?
9. Is a new component necessary?
10. What is the security impact?
11. What is the maintenance burden?
12. What is the runtime overhead?
13. How will improvement be measured?
14. How can the change be reverted?

## Style

- Lead with a 5–10 line summary of what is established, then the detail.
- Tables and citations over prose; full sentences in prose; define a term on first use.
- Every important claim carries its evidence label.
- End with "Not covered" (what nobody examined) and "Open questions".
- Target 250–450 lines. Link to findings sections instead of copying long tables.
- No plan/phase/finding codes in anything meant to become code or file names later.
