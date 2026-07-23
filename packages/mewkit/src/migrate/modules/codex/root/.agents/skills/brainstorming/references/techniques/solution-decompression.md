# Technique: Solution Decompression (Problem-First Inversion)

## When to Apply
Input arrives as a SOLUTION, not a problem: "build a notification system", "add feature Y",
"the roadmap says we need Z", "just build X". Treat the proposed solution as a compressed
confession of a problem the user senses but has not articulated. Decompress before ideating.

**NOT for:** "how could this FAIL?" failure-mode inversion → use `reverse.md`.
**NOT for:** "is this worth building?" product validation → route to `mk:office-hours`.

Trigger test: can you name a problem the solution does NOT already encode? If yes, decompress.
If the input is already a problem statement (no preselected solution), skip this technique.

## Iron Rule
Do not debate the solution's feasibility first. First ask: what pain would make a reasonable
person propose this? Use the solution as the research artifact, not the target.

## Process (4 sections — emit ALL before generating ideas)
1. **Solution-jumping diagnosis** — what signal/pain/complaint made this solution feel necessary?
2. **Decompressed problem** — state the underlying user/system problem WITHOUT naming the
   proposed solution as the answer.
3. **Three alternative problem framings** — Frame A / B / C, each a different interpretation of
   the problem with a DIFFERENT solution space. The original solution may match at most one frame.
4. **Key assumption challenge** — the single load-bearing assumption behind the original solution
   + risk-if-wrong + a one-line validation test.

## Fail-Closed Boundary
If section 2/4 reveals the problem's VALUE is unvalidated (mostly vibes, one anecdote), STOP.
Route to `mk:office-hours`. Do not grade evidence or run validation here.

## After Decompression
Pick the framing with the user (or recommend one), then resume normal exploration on that
framing: generate 3-8 ideas → anti-bias pivot → challenge pass → converge.

## Output Shape
| Section | Content |
|---|---|
| Solution-jumping diagnosis | [signal/pain] |
| Decompressed problem | [problem, solution-free] |
| Framing A / B / C | [interpretation + solution space] ×3 |
| Key assumption | [assumption + risk-if-wrong + validation test] |

## Example
**Input:** "We need to build a new notification system."
- Diagnosis: users miss state changes; support tickets about lost context.
- Decompressed problem: users can't see when state changes in-product; visibility gap erodes trust.
- Framing A (don't know when context changed) → state-change indicators, activity feed.
- Framing B (don't trust system is working) → status visibility, audit trail, confidence signals.
- Framing C (want to delegate watching) → subscriptions, smart digests, agent alerts.
- Key assumption: "users want more notifications." Risk if wrong: added noise, adoption drops.
  Validation: pull notification engagement data from the current system.
