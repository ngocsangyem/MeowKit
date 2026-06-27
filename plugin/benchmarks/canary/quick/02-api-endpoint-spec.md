---
benchmark_task: 02-api-endpoint
tier: quick
target_seconds: 120
target_cost_usd: 1.00
rubric_preset: backend-api
---

# Task: Express GET /healthz Endpoint

Build a tiny Express server with a single endpoint:

- `GET /healthz` → returns `200 OK` with body `{"status":"ok","ts":<iso timestamp>}`
- Server listens on port 3000 (or `PORT` env var if set)
- One file: `server.ts`
- One test file: `server.test.ts` that:
  1. Imports the server
  2. Sends GET /healthz via supertest
  3. Asserts status 200 and shape `{status:"ok", ts:<string>}`

## Acceptance Criteria

- [ ] `server.ts` compiles
- [ ] `server.test.ts` has at least 1 passing test
- [ ] Manual curl `curl localhost:3000/healthz` returns 200 with the expected JSON shape (verify by booting the server)
- [ ] No console errors on startup

## Notes

Smallest possible backend canary. Tests the harness's ability to wire a single endpoint + dep + boot + curl probe.
