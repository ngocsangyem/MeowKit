# Implementation Failure Catalog

Common failure modes during code implementation. Read before starting any build work.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll test it all at the end" | Bugs compound. A bug in Slice 1 makes Slices 2-5 wrong. Test each slice. |
| "It's faster to do it all at once" | It feels faster until something breaks and you can't find which of 500 changed lines caused it. |
| "These changes are too small to commit separately" | Small commits are free. Large commits hide bugs and make rollbacks painful. |
| "This refactor is small enough to include" | Refactors mixed with features make both harder to review and debug. Separate them. |
| "I already know how to do this" | Knowing is not planning. Write it down. Undisciplined action wastes tokens. |
| "Let me just start coding" | Fastest path = plan then implement then done. Not: implement then debug then rewrite. |

## Red Flags

Observable patterns that indicate you're off-track:

- Skipping Gate 1 because the task "feels simple"
- More than 100 lines of code written without running tests
- Multiple unrelated changes in a single increment
- "Let me just quickly add this too" — scope expansion mid-build
- Build or tests broken between increments
- Large uncommitted changes accumulating
- Touching files outside the task scope "while I'm here"
- Building abstractions before the third use case demands it
- Creating new utility files for one-time operations
