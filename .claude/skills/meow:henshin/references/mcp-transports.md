# MCP Transports

Wrapped server must support **stdio**, **SSE**, and **Streamable HTTP** from a single core `Server` instance. Three transport adapters, one tool registry.

Load during Phase 3 (Agentize Map) when designing the MCP surface and Phase 4 (Challenge) when deciding deployment targets.

## Transport selection

Entry (`bin.ts`):

```ts
const transport = process.env.MCP_TRANSPORT ?? flag("--transport") ?? "stdio";
switch (transport) {
  case "stdio": await startStdio(server); break;
  case "sse":   await startSse(server, { port }); break;
  case "http":  await startStreamableHttp(server, { port }); break;
  default:      die(`unknown transport: ${transport}`);
}
```

## stdio — default for local agent processes

Claude Code, Cursor, and similar clients spawn the server as a child process.

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const t = new StdioServerTransport();
await server.connect(t);
```

- No auth at transport layer — trust the spawning parent
- Credentials resolved from env + config files (same chain as CLI)
- **Never** write non-protocol bytes to stdout; logs go to stderr

## SSE — legacy compatibility

Keep for older clients; document Streamable HTTP as preferred.

```ts
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const transports: Record<string, SSEServerTransport> = {};

app.get("/sse", async (req, res) => {
  const t = new SSEServerTransport("/messages", res);
  transports[t.sessionId] = t;
  res.on("close", () => delete transports[t.sessionId]);
  await server.connect(t);
});

app.post("/messages", async (req, res) => {
  const sessionId = String(req.query.sessionId ?? "");
  const t = transports[sessionId];
  if (!t) { res.status(400).send("unknown session"); return; }
  await t.handlePostMessage(req, res);
});
```

- Constructor takes a Node `http.ServerResponse` — use Express/Node raw `res`, **not** a Hono `c.res` (web-standard `Response`)
- Keep a per-session transport map so `/messages` POSTs route to the right client
- Bearer token auth before upgrade
- Heartbeats to keep proxies from idling the connection

## Streamable HTTP — preferred remote transport

Required for Cloudflare Workers and most PaaS. Modern, resumable, works behind standard HTTP load balancers.

```ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
app.all("/mcp", async (c) => {
  const t = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  await server.connect(t);
  return t.handleRequest(c.req.raw, c.res);
});
```

- Single endpoint handles POST (requests) and GET (stream)
- Session ID header `mcp-session-id` maps to server state
- Supports resumable streams

## Session state

| Runtime | Session storage |
|---|---|
| stdio (local) | In-memory per process |
| SSE + HTTP on Cloudflare Workers | **Durable Objects** keyed by session ID |
| SSE + HTTP on Docker / Node | In-memory with sticky sessions, or Redis when scaling horizontally |

## Auth

**stdio** trusts the parent. **SSE** and **HTTP** require bearer tokens:

```
Authorization: Bearer <token>
```

- Reject unauthenticated requests early with `401` + a clean MCP-level error on the first request
- Do **not** leak which tokens exist in the error message
- Rate-limit by token

Token sources per deployment:

- **Cloudflare:** Workers Secrets — `wrangler secret put MCP_TOKEN`
- **Docker:** env var from a secret manager (never baked into image)
- **Self-host / PaaS:** same; `.env` in production only if the host filesystem is trusted

## Tool registration

Every tool is registered **once** against the core `Server`; all three transports expose the identical tool set.

```ts
server.tool(
  "list_projects",
  "List all projects for the authenticated user. Returns concise records (id, name, status). Use `format: detailed` for full data.",
  {
    format: z.enum(["concise", "detailed"]).default("concise"),
    limit:  z.number().int().min(1).max(100).default(25),
  },
  async (args, ctx) => core.listProjects({ ...args, auth: ctx.auth }),
);
```

## Health and observability

Expose on HTTP transports:

- `GET /healthz` — 200 when server is up and core dependencies are reachable
- `GET /readyz` — 200 when ready to serve (warmup complete)
- Structured JSON logs to stderr with `trace_id`, `session_id`, `tool_name`, `duration_ms`
- **Never** log tool arguments (they may contain secrets or PII)

Do not expose metrics without auth. If Prometheus scraping is needed, mount on a separate internal port bound to loopback.

## Deployment target matrix

| Target | stdio | SSE | Streamable HTTP | Session state |
|---|---|---|---|---|
| Local (spawned) | ✓ | — | — | In-memory |
| Cloudflare Workers | ✗ | ✓ | ✓ *preferred* | Durable Objects |
| Docker | — | ✓ | ✓ *preferred* | In-memory + sticky, or Redis |
| Fly.io / Railway / Render | — | ✓ | ✓ *preferred* | Same as Docker |

stdio cannot run on Workers. Build stdio locally, test it, omit it from the Workers target.

## Gotchas

- **Writing to stdout in stdio mode corrupts the protocol.** Every `console.log` statement in code reachable from stdio-mode is a bug. Route logs to stderr; add a lint rule that bans `console.log` in `packages/mcp/src/`.
- **SSE behind HTTP proxies idles out.** Long-running proxies (Cloudflare, Nginx) close idle connections at 30–120s. Ship heartbeats every 15s by default.
- **Session IDs must be UUIDs, not sequential.** Predictable session IDs enable cross-session hijacking when combined with weak auth.
- **Cloudflare Workers has no filesystem.** Any `fs.readFile` in the code path breaks deployment silently. Pre-inline static assets or read them via `fetch` from R2/KV.
- **`nodejs_compat` is not a free pass.** Use it sparingly; prefer web APIs. Modules like `child_process`, `net`, `dgram` still will not work.
- **One server, three transports — test each.** Tool works in stdio but fails in HTTP is the most common regression. Integration tests must boot each transport and call at least one tool end-to-end.
