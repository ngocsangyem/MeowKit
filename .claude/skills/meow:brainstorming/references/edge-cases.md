# Edge Cases

Situations where the obvious brainstorming approach is wrong. Pattern adapted from `everything-claude-code/quality-nonconformance`.

## 1. The user says "just brainstorm" but the problem is actually invalidated

The user wants to skip ahead to "how" but they haven't confirmed "what" or "why". The instinct is to comply with the request — resist it. Ask one targeted question to surface the unvalidated assumption. If the answer is unclear, redirect to `meow:office-hours` before continuing.

## 2. Three "approaches" turn out to be variations of the same idea

You generated `WebSocket`, `Socket.IO`, and `ws library` as three approaches. They're not three approaches — they're three implementations of the same approach. When this happens, drop them all and force one orthogonal angle: e.g., "what if the client polled?" or "what if we used a queue?"

## 3. The user keeps redirecting to a specific answer

Every clarifying question gets steered back to a preferred solution. The user has already decided. Don't fight it — instead, name it: "It sounds like you've decided on X. Do you want me to brainstorm alternatives, or stress-test the X choice?" If stress-test, switch technique to `reverse.md`.

## 4. The "novel problem" turns out to be a well-known pattern

You started with `first-principles.md` because the problem looked unique. Halfway through, you realize this is actually a standard producer-consumer queue. Stop. Switch to `multi-alternative.md` and use the standard patterns. Don't reinvent the wheel just because the technique you started with is sunk cost.

## 5. Constraints conflict and no solution satisfies all hard constraints

Using `constraint-mapping.md`, the intersection is empty. Don't fabricate a solution that fudges a hard constraint. STOP and report: "Hard constraints A and B cannot both be satisfied. Options: relax A, relax B, or accept neither and rescope." Hand back to the user.

## 6. All scored ideas come back at similar scores

If your top 3 are 32, 31, 30 out of 45 — the scoring isn't separating signal. Either the criteria don't match what the user actually cares about, or the ideas are truly equivalent. Ask the user: "What's the one criterion that would break the tie?" Re-score against that single criterion.

## 7. The user accepts the first idea you list

Anchoring bias on the user side. Before accepting, force a comparison: "Idea #1 wins on [X]. Idea #3 wins on [Y]. Which trade-off matters more for your situation?" If the user still picks #1 with that information, they've made an informed choice — proceed.

## 8. You generated 8 ideas but they're all conservative

If every idea scores ≤ 2 on novelty, you've stayed inside the comfort zone. Force one wild idea before closing: apply `first-principles.md` to the same problem and see what falls out. Even if you don't recommend it, having it on the list re-grounds the conservative options.
