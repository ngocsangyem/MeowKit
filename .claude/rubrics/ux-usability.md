---
name: ux-usability
version: 1.0.0
weight_default: 0.05
applies_to: [frontend, fullstack, cli]
hard_fail_threshold: WARN
---

# UX & Usability

## Intent

Measures whether a **first-time user can complete the core value action without assistance**. Distinct from `craft` (which is about polish details) — this is about flow comprehension, discoverability, and the absence of dead-ends. The lowest-weighted rubric (5%) but the one most correlated with whether a real human would use the product.

## Criteria

- A first-time user can reach the core value action within ≤90 seconds without instructions
- Primary CTAs are visually dominant on every screen (one obvious next action)
- Navigation is consistent (same pattern across screens; no surprise UI changes)
- Errors recover gracefully — every error state has a path forward (button, link, instruction)
- No dead-ends — every leaf screen has a way back or a related action
- Required-information forms are progressively disclosed, not 12 fields on first load

## Grading

| Level | Definition |
|---|---|
| PASS | Time-to-core-value ≤90s + no dead-ends + recoverable errors + progressive forms |
| WARN | Core value reachable but ≥120s OR 1 dead-end OR 1 unrecoverable error |
| FAIL | Core value action is hidden / requires instructions / takes >180s OR multiple dead-ends OR errors trap the user |

## Anti-patterns

- Required-info onboarding wall (10 fields before any value)
- Hidden CTAs (the "Submit" button is below the fold and ungrayed)
- Inconsistent navigation between screens (sidebar on one, top nav on the next)
- "Something went wrong" with no recovery path
- Modal dialogs with no close button or X
- Infinite loading states with no time hint or cancel
- Progress bars that go backwards or get stuck

## Few-Shot Examples

### Example 1 — PASS

**Artifact:** Note-taking app. Landing on the empty board immediately shows "Press `n` to start a note" with a visible button as fallback. Click → typing area focused. Type → save indicator. Total time-to-first-note: 12 seconds without docs. Errors show inline with retry buttons. No required signup.
**Verdict:** PASS
**Reasoning:** Time-to-value 12s, no dead-ends, errors recoverable, no onboarding wall.

### Example 2 — FAIL

**Artifact:** Same note-taking app, but with an onboarding flow: 4-step welcome, email + password + display name + team name + "What will you use this for?" form, then a confirmation email step. Total time to first note: ~4 minutes assuming user has email open. Skipping any field shows "This field is required" with no skip option.
**Verdict:** FAIL
**Reasoning:** Time-to-value >180s, onboarding wall blocks progression, no skip path. Hard FAIL — the value the spec promised is gated behind unnecessary friction.

## References

- Anthropic harness article §4 (UX as the proxy for "would a human use this")
