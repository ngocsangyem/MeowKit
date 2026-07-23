# Token Budget Levels

Controls response depth. Determines how much the agent expands on a topic based on user signals and task complexity. Silent by default — do not surface this system to users unless they ask.

## The 4 Levels

| Level | Token Budget | Output Shape | Use When |
|---|---|---|---|
| Essential | 25% | 2-4 sentences | Lookup, quick fact, one-liner fix |
| Moderate | 50% | 1-3 paragraphs | Explanation, how-to, standard task |
| Detailed | 75% | Structured sections, examples | Complex topic, multi-step task |
| Exhaustive | 100% | No length limit, full depth | Architectural decision, deep audit |

## Auto-Detection: User Signals (highest priority)

Scan user message for explicit depth signals before applying complexity fallback.

| Signal Words | Level | Budget |
|---|---|---|
| "brief", "short", "tldr", "quick", "just tell me", "one line" | Essential | 25% |
| "explain", "how does", "walk me through", "what is" | Moderate | 50% |
| "detailed", "thorough", "in depth", "comprehensive", "step by step" | Detailed | 75% |
| "exhaustive", "everything", "all of it", "complete", "don't leave anything out" | Exhaustive | 100% |

When multiple signals conflict, the more explicit one wins. "Brief but thorough" → Moderate (split the difference).

## Complexity Fallback (when no user signal present)

Map from complexity detection output when user gives no depth signal:

| Complexity Level | Default Budget |
|---|---|
| TRIVIAL | 25% (Essential) |
| STANDARD | 50% (Moderate) |
| COMPLEX | 75% (Detailed) |

COMPLEX tasks that involve security, payments, or architecture always start at Detailed regardless of message brevity.

## Session Persistence

Once a depth level is established for a session, maintain it across follow-up messages until the user explicitly changes it.

- User sets "detailed" → all follow-ups in that session are Detailed until changed
- New task in same session inherits prior level unless new signal detected
- Explicit override always takes precedence over session persistence

## Silent Operation

Do NOT show a token budget menu or depth selector to users unless they:
- Ask about response length ("why is your answer so long?")
- Ask about depth options ("can you be more detailed?")
- Ask about the token budget system explicitly

The detection runs silently. The banner output from `mk:agent-detector` shows complexity and model tier — budget level is an internal parameter, not a user-facing concept.

## Integration with Detection Banner

Budget level informs how the agent expands its response after detection. It does not change the agent or model selected. The detection banner remains unchanged; only response verbosity is adjusted.
