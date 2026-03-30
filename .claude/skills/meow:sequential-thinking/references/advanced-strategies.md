# Advanced Sequential Thinking Strategies

> Filtered for MeowKit: kept uncertainty management + revision cascade. Dropped meta-thinking (YAGNI) and parallel constraint (meow:brainstorming handles this).

## Uncertainty Management

Handle incomplete information systematically.

```
Thought 2/7: Need to decide X
Thought 3/7: Insufficient data—two scenarios possible
Thought 4/7 [SCENARIO A if P true]: Analysis for A
Thought 4/7 [SCENARIO B if P false]: Analysis for B
Thought 5/7: Decision that works for both scenarios
Thought 6/7: Or determine critical info needed
Thought 7/7 [FINAL]: Robust solution or clear info requirement
```

**Use for**: Decisions under uncertainty, incomplete requirements.

**Strategies**:

- Find solution robust to uncertainty
- Identify minimal info needed to resolve
- Make safe assumptions with clear documentation

## Revision Cascade Management

Handle revisions that invalidate multiple subsequent thoughts.

```
Thought 1/8: Foundation assumption
Thought 2/8: Build on Thought 1
Thought 3/8: Further build
Thought 4/8: Discover Thought 1 invalid
Thought 5/8 [REVISION of Thought 1]: Corrected foundation
Thought 6/8 [REASSESSMENT]: Which of 2-3 still valid?
  - Thought 2: Partially valid, needs adjustment
  - Thought 3: Completely invalid
Thought 7/8: Rebuild from corrected Thought 5
Thought 8/8 [FINAL]: Solution on correct foundation
```

**Key**: After major revision, explicitly assess downstream impact. Don't just fix the root — trace what it invalidates.
