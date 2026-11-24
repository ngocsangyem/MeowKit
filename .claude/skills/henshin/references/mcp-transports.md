# MCP transports

What the transformation spec must decide when the surface includes an MCP server. This file states the decisions and their reasons; the code belongs to the plan the downstream skill writes, because transport APIs and SDK versions change (check current docs when the plan is written).

Load when designing the MCP surface and when the user decides deployment targets.

## Contents

- [Transport choice](#transport-choice)
- [Session state](#session-state)
- [Auth](#auth)
- [Tools, health and logging](#tools-health-and-logging)
- [Deployment targets](#deployment-targets)
- [Gotchas](#gotchas)

## Transport choice

One core server, one tool registry, thin transport adapters. Pick from the deployment target:

| Transport | Use when | Notes |
|---|---|---|
| stdio | A local agent host spawns the server as a child process (the default) | No transport-level auth; trusts the parent. Credentials come from the same chain as the CLI |
| Streamable HTTP | The server runs remotely | The preferred remote transport: one endpoint for requests and the event stream, resumable, works behind ordinary HTTP load balancers |
| SSE | Older clients still need it | Legacy; keep only for compatibility and document Streamable HTTP as preferred |

The spec states which transports ship in v1 and why; every extra transport is another adapter to test and secure.

## Session state

| Runtime | Session storage |
|---|---|
| stdio, local | In-memory per process |
| Remote on a serverless edge platform | A durable per-session store keyed by session id |
| Remote on a container or PaaS | In-memory with sticky sessions, or a shared store when scaling out |

## Auth

stdio trusts its parent. Remote transports require bearer tokens, checked before any session is established. Reject unauthenticated requests early with a clean MCP-level error that does not reveal which tokens exist, and rate-limit by token. Token source per deployment: the platform's secret store; never baked into an image. The spec names the source; `references/auth-resolution-chain.md` covers credentials in general.

## Tools, health and logging

- Register every tool once against the core server so all transports expose the same set.
- Remote transports expose a liveness and a readiness endpoint; metrics, if any, go on an internal port without public auth.
- Logs go to stderr as structured records (trace id, session id, tool name, duration). Never log tool arguments: they may hold secrets or personal data.

## Deployment targets

| Target | stdio | SSE | Streamable HTTP | Session state |
|---|---|---|---|---|
| Local (spawned) | yes | no | no | In-memory |
| Serverless edge | no | yes | yes (preferred) | Durable per-session store |
| Container | no | yes | yes (preferred) | In-memory + sticky, or shared store |
| PaaS | no | yes | yes (preferred) | Same as container |

stdio cannot run on a serverless edge platform: build and test it locally and leave it out of that target.

## Gotchas

- Writing to stdout in stdio mode corrupts the protocol: any print on a path reachable from stdio is a bug, so logs go to stderr and the plan bans stdout prints in the MCP package.
- Proxies close idle SSE connections after roughly 30 to 120 seconds: send heartbeats well inside that window.
- Session ids must be unpredictable (random UUIDs), because sequential ids plus weak auth allow session hijacking.
- A serverless edge runtime has no filesystem and no Node-only modules (`child_process`, `net`): inline static assets or fetch them from object storage.
