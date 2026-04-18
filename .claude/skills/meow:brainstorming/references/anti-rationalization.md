# Anti-Rationalization

Adapted from `claudekit-engineer/brainstorm`. These are the common excuses Claude or the user invents to skip the brainstorming process. When you catch yourself thinking one of these, do the opposite.

## Skip-the-process excuses

| Thought | Reality |
|---|---|
| "This is too simple to need brainstorming" | Simple problems are where unexamined assumptions hide. The simpler it looks, the faster you can write 2 alternatives. |
| "I already know the right answer" | Then writing 2 alternatives takes 60 seconds. If you can't, you didn't know — you guessed. |
| "User wants action, not talk" | Bad action wastes more time than 5 minutes of thinking. Architecture is the hardest thing to iterate on. |
| "Let me look at the code first" | Brainstorming tells you HOW to look. Restate the problem first; the code grows context, not direction. |
| "We can iterate on the implementation" | You can iterate on a function. You cannot easily iterate on the choice between WebSocket vs polling. |
| "There's only one obvious approach" | Force a second one anyway. The contrast often reveals a hidden assumption in the "obvious" one. |

## Skip-the-decomposition excuses

| Thought | Reality |
|---|---|
| "It's all one feature, I'll think about it together" | If it has 3+ independently-shippable concerns, it's 3 brainstorms in a trench coat |
| "User said it's all one thing" | Users describe outcomes, not architectures. Decompose anyway and confirm |
| "Decomposing slows us down" | Brainstorming an undecomposed monolith produces unusable output. That's slower |

## Skip-the-discovery excuses

| Thought | Reality |
|---|---|
| "I have enough context already" | Did you confirm the actual *constraint* (budget? latency? team size?) — or are you assuming? |
| "More questions annoy the user" | One batch of 3 targeted questions is faster than 4 wrong ideas |
| "The constraint is obvious" | The constraint the user *cares* about is rarely the one you'd guess from the request |

## Skip-the-anti-bias-pivot excuses

| Thought | Reality |
|---|---|
| "All my ideas are good, why pivot?" | "All in the same category" usually means "all variations of the first one" |
| "Pivoting feels forced" | Yes — that's the point. Semantic clustering is the LLM default; the pivot is the antidote |
| "There aren't other categories" | Try: infra → workflow → UX → business model → data shape. One always applies |
