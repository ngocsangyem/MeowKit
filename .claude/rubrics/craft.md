---
name: craft
version: 1.0.0
weight_default: 0.05
applies_to: [frontend, backend, fullstack, cli]
hard_fail_threshold: WARN
---

# Craft

## Intent

Measures the **small details** that distinguish a finished product from a demo: keyboard support, focus states, hover affordances, loading skeletons, transitions, microcopy, accessibility hints. Craft is the lowest-weighted rubric (5%) because it's noise on early prototypes — but it's a tiebreaker between two builds that pass everything else, and its presence signals a generator that respects the user.

## Criteria

- Interactive elements have visible focus states (keyboard accessible)
- Hover states exist on buttons and links (cursor + visual feedback)
- Loading states use skeletons or spinners with a max-wait copy ("This may take ~10s")
- Forms have inline validation messages (not just "invalid")
- Microcopy is helpful and human, not robotic ("No tasks yet — add one above" beats "List is empty")
- Transitions are subtle (≤300ms) and purposeful (no spinning logos, no fade-in-on-scroll noise)

## Grading

| Level | Definition |
|---|---|
| PASS | All 6 criteria met across the primary user flow |
| WARN | 3-5 criteria met; gaps are visible but don't block use |
| FAIL | <3 criteria met OR critical accessibility miss (no keyboard nav, no focus states anywhere) |

## Anti-patterns

- Buttons with no hover state and no focus ring
- "Loading..." with no spinner, no skeleton, no time hint
- Generic "Error" messages without explaining what failed or what to do
- Animations longer than 500ms on every transition
- Spinning logos as loading indicators
- Forms that validate only on submit
- Microcopy written by a robot ("Operation completed successfully")

## Few-Shot Examples

### Example 1 — PASS

**Artifact:** Note-taking app. Tab key cycles through buttons with a 2px focus ring. Buttons darken on hover with a 150ms ease. Saving shows a skeleton in the note list, then a checkmark. Empty state copy: "No notes yet. Press `n` to start one." Form validation appears as you type, with a friendly hint. All transitions are 200ms cubic-bezier.
**Verdict:** PASS
**Reasoning:** All 6 criteria. Microcopy is human and useful. Keyboard hint included.

### Example 2 — FAIL

**Artifact:** Same note-taking app, but: NO keyboard navigation (Tab does nothing on the page), no visible focus rings anywhere, buttons have no hover state, loading is "Loading..." text with no spinner or skeleton, errors are alert() popups saying "Error", microcopy is robotic ("Operation completed successfully"), spinning logo as the loading indicator on every action.
**Verdict:** FAIL
**Reasoning:** Critical accessibility miss (no keyboard nav, no focus states anywhere) is the explicit FAIL trigger. Plus 0/6 craft criteria met. Hard FAIL despite craft being a low-weight rubric.

## References

- Anthropic harness article §4 (craft as tiebreaker dimension)
- Craft is the rubric that distinguishes "looks good in a screenshot" from "feels good in 30 seconds of use"
