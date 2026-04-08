---
name: design-quality
version: 1.0.0
weight_default: 0.15
applies_to: [frontend, fullstack]
hard_fail_threshold: FAIL
---

# Design Quality

## Intent

Measures whether the visual design demonstrates **intentional craft** — typographic discipline, deliberate color use, consistent spacing, hierarchy that serves the content. Penalizes generic AI defaults ("purple gradient on white card with serif headline + sans body"). Anthropic's research weights design+originality higher than functionality precisely because solo agents default to visual slop.

## Criteria

- Typography uses ≤2 font families with deliberate contrast (display/body)
- Spacing follows a visible scale (4px / 8px / 16px grid or comparable)
- Color palette is restricted (≤6 hues) and intentional — not "every gradient looks great"
- Visual hierarchy guides the eye to the primary action on every screen
- Component styling is consistent across screens (buttons, inputs, cards share a vocabulary)
- Empty states, loading states, and error states are designed (not browser defaults)

## Grading

| Level | Definition |
|---|---|
| PASS | ≤2 fonts + visible spacing scale + ≤6 hues + consistent components + designed empty/loading/error states |
| WARN | 2-3 design dimensions weak but no anti-patterns; primary screens still feel cohesive |
| FAIL | Any anti-pattern present OR visible inconsistency between screens OR browser-default form widgets in a styled product |

## Anti-patterns

- Purple/indigo gradient over white card (default AI slop signature)
- Stock font pairing: serif headline + Helvetica/Inter body (default AI slop signature)
- Spacing varies arbitrarily — no visible grid
- 8+ different colors used because "they all matched the brand"
- Browser-default `<input>` / `<select>` styling inside an otherwise-styled product
- Centered hero text on every screen because "centered looks safe"
- Card-on-card-on-card layout (cards inside cards inside cards)

## Few-Shot Examples

### Example 1 — PASS

**Artifact:** Kanban app with Inter Variable for everything (one font, weight contrast for hierarchy). Spacing on a visible 8px grid. Five colors total: ink, paper, accent, success, danger. Buttons have one shape across the app. Empty board shows custom illustration + CTA. Loading shows skeleton. 404 shows custom page.
**Verdict:** PASS
**Reasoning:** All 6 criteria met. No anti-patterns. Consistent vocabulary across screens.

### Example 2 — FAIL

**Artifact:** Dashboard with purple→pink gradient hero, white cards floating on a gray background, Playfair Display headlines + Inter body, 11 distinct colors across the homepage, default Bootstrap form widgets on signup, no empty state for the empty dashboard.
**Verdict:** FAIL
**Reasoning:** Multiple anti-patterns: gradient slop signature, font pairing slop signature, browser-default widgets in styled product, missing empty state. This is the canonical "AI generated a pretty-looking demo" failure mode.

## Tier-Specific Notes

For TRIVIAL tier (Haiku) builds, downgrade FAIL to WARN on anti-pattern matches — Haiku doesn't get visual judgment. For COMPLEX tier (Opus 4.6+) hold the FAIL threshold strict — capable models have no excuse.

## References

- Anthropic harness article §4 (design weighted higher to penalize slop)
- research/researcher-01-harness-patterns.md §4
