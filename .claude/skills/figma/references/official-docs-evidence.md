# Official Docs Evidence

Claim → official-doc source matrix. Every capability claim the skill makes must trace to a row here or
to the strategy audit; unbacked behavior is labeled UNCERTAIN. Support file — load when auditing a claim.

URLs verified at the audit date recorded below; re-verify on the next skill audit.

## Contents

- [Sources](#sources)
- [Claim matrix](#claim-matrix)
- [Uncertain / not established](#uncertain--not-established)

## Sources

- Figma REST API introduction — https://developers.figma.com/docs/rest-api/
- File endpoints — https://developers.figma.com/docs/rest-api/file-endpoints/
- Variables endpoints — https://developers.figma.com/docs/rest-api/variables-endpoints/
- Code Connect — https://developers.figma.com/docs/code-connect/
- Dev Resources — https://developers.figma.com/docs/rest-api/dev-resources/
- File node types — https://developers.figma.com/docs/rest-api/file-node-types/

Audit date: 2026-07-04 (strategy audit). Context7 returned no usable combined doc; official Figma docs
were used directly.

## Claim matrix

| Claim | Consequence for the skill | Source |
|---|---|---|
| REST API extracts file objects, layers, properties, usage data, webhooks, variables, dev resources | Read path can rely on structured JSON, not scraping | REST API intro |
| File/node endpoints expose JSON node trees + component/style metadata; partial fetches by IDs still include ancestor chains and may include dependencies | Targeted node fetch is viable, but responses carry ancestor context — size-aware handling needed | File endpoints |
| Image exports can return expiring URLs, may return `null` for failed renders, and have size/format constraints | Download assets promptly; handle null renders; validate format/scale | File endpoints |
| Variables API has separate local, published, and POST methods | Token mode must distinguish local vs published variables | Variables endpoints |
| Local variables are gated to full members of Enterprise orgs | Token mode fails loud on 403 with a permission explanation | Variables endpoints |
| Variable endpoints require specific scopes | Create variables with the narrowest scope, not ALL_SCOPES | Variables endpoints |
| Code Connect is available on Dev or Full seats for Organization/Enterprise plans | Code Connect reference is entitlement-gated | Code Connect |
| Code Connect connects codebase components to Dev Mode and improves MCP context with real code references | Benefit statement for the Code Connect workflow | Code Connect |
| Dev Resources attach developer URLs to nodes in Dev Mode and do not need publishing | Lightweight alternative to full Code Connect | Dev Resources |
| REST node types expose component/component-set definitions and instance component properties | Variant handling reads `componentPropertyDefinitions`, useful for implement + Code Connect matching | File node types |

## Uncertain / not established

- **Generic prototype-flow extraction** — local Plugin API references expose reaction/prototype APIs,
  but the reviewed official REST docs do not establish a generic prototype-flow extraction workflow.
  Treat prototype understanding as ADVISORY unless the MCP returns explicit interaction metadata.
- **Exact MCP connectivity-probe tool name** — varies by Figma MCP server version; verify against the
  live server's tool list (see `mcp-setup-and-tool-selection.md`).
- **Node-count fallback thresholds** (20-node/15-batch) — observed heuristics, not official limits.
