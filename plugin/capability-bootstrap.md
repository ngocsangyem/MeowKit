## Capability resolution

Some tasks need a capability that isn't already in front of you — an external or specialized tool, repository-wide discovery, delegation to a sub-agent, or a verification you can't perform inline. When that happens, resolve the capability first instead of guessing or hand-rolling it.

Resolve when the task needs: an external/specialized tool, integration, or service; discovery or search across the repository beyond the files in context; delegation to a specialized sub-agent; or a verification you don't already have.

Don't resolve for ordinary in-context work — reading, editing, or running a file you already have is not a capability lookup. If nothing specialized is required, proceed directly.

How: run `mewkit capabilities resolve --intent "<what you're trying to do>"`. It returns a ranked, evidence-based result:
- `selected` — one capability fits and is available; use the returned invocation.
- `ambiguous` — several fit; choose by the reasons given, or ask the user.
- `unavailable` — it exists but a requirement (binary, integration, permission) is missing; fall back or escalate — do not retry blindly.
- `unsupported` — this host can't provide it; state the limitation.

Trust the availability verdict: an `unavailable` capability will not become available by calling it again.
