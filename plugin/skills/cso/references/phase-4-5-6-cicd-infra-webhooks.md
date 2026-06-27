# Phase 4: CI/CD Pipeline Security

Check who can modify workflows and what secrets they can access.

**GitHub Actions analysis:** For each workflow file, check for:
- Unpinned third-party actions (not SHA-pinned) — use Grep for `uses:` lines missing `@[sha]`
- `pull_request_target` (dangerous: fork PRs get write access)
- Script injection via `${{ github.event.* }}` in `run:` steps
- Secrets as env vars (could leak in logs)
- CODEOWNERS protection on workflow files

**Severity:** CRITICAL for `pull_request_target` + checkout of PR code / script injection via `${{ github.event.*.body }}` in `run:` steps. HIGH for unpinned third-party actions / secrets as env vars without masking. MEDIUM for missing CODEOWNERS on workflow files.

**FP rules:** First-party `actions/*` unpinned = MEDIUM not HIGH. `pull_request_target` without PR ref checkout is safe (precedent #11). Secrets in `with:` blocks (not `env:`/`run:`) are handled by runtime.

# Phase 5: Infrastructure Shadow Surface

Find shadow infrastructure with excessive access.

**Dockerfiles:** For each Dockerfile, check for missing `USER` directive (runs as root), secrets passed as `ARG`, `.env` files copied into images, exposed ports.

**Config files with prod credentials:** Use Grep to search for database connection strings (postgres://, mysql://, mongodb://, redis://) in config files, excluding localhost/127.0.0.1/example.com. Check for staging/dev configs referencing prod.

**IaC security:** For Terraform files, check for `"*"` in IAM actions/resources, hardcoded secrets in `.tf`/`.tfvars`. For K8s manifests, check for privileged containers, hostNetwork, hostPID.

**Severity:** CRITICAL for prod DB URLs with credentials in committed config / `"*"` IAM on sensitive resources / secrets baked into Docker images. HIGH for root containers in prod / staging with prod DB access / privileged K8s. MEDIUM for missing USER directive / exposed ports without documented purpose.

**FP rules:** `docker-compose.yml` for local dev with localhost = not a finding (precedent #12). Terraform `"*"` in `data` sources (read-only) excluded. K8s manifests in `test/`/`dev/`/`local/` with localhost networking excluded.

# Phase 6: Webhook & Integration Audit

Find inbound endpoints that accept anything.

**Webhook routes:** Use Grep to find files containing webhook/hook/callback route patterns. For each file, check whether it also contains signature verification (signature, hmac, verify, digest, x-hub-signature, stripe-signature, svix). Files with webhook routes but NO signature verification are findings.

**TLS verification disabled:** Use Grep to search for patterns like `verify.*false`, `VERIFY_NONE`, `InsecureSkipVerify`, `NODE_TLS_REJECT_UNAUTHORIZED.*0`.

**OAuth scope analysis:** Use Grep to find OAuth configurations and check for overly broad scopes.

**Verification approach (code-tracing only — NO live requests):** For webhook findings, trace the handler code to determine if signature verification exists anywhere in the middleware chain (parent router, middleware stack, API gateway config). Do NOT make actual HTTP requests to webhook endpoints.

**Severity:** CRITICAL for webhooks without any signature verification. HIGH for TLS verification disabled in prod code / overly broad OAuth scopes. MEDIUM for undocumented outbound data flows to third parties.

**FP rules:** TLS disabled in test code excluded. Internal service-to-service webhooks on private networks = MEDIUM max. Webhook endpoints behind API gateway that handles signature verification upstream are NOT findings — but require evidence.
