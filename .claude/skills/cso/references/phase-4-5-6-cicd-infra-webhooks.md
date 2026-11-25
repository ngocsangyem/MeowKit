# Phase 4: CI/CD Pipeline Security

Check who can modify workflows and what secrets they can access.

**GitHub Actions analysis:** For each workflow file, check for:
- Unpinned third-party actions (not SHA-pinned) — use Grep for `uses:` lines missing `@[sha]`
- `pull_request_target` (dangerous: fork PRs get write access)
- Script injection via `${{ github.event.* }}` in `run:` steps
- Secrets as env vars (could leak in logs)
- CODEOWNERS protection on workflow files
- `workflow_run` and `issue_comment` triggers that check out or execute PR-controlled content with secrets in scope (the same hazard as `pull_request_target`, less often noticed)
- Token scope: a top-level `permissions:` block, least privilege per job, and `id-token: write` / `contents: write` only on the job that publishes
- Cache crossing a trust boundary: a cache written by a PR-triggered job and restored by a release or publish job lets PR code reach the release
- Release path: which job builds the artifact, which writes its checksums, and whether one compromised step could change both; whether a published tag or asset can be replaced afterwards
- Self-hosted runners reachable from fork PRs (a persistent runner keeps what a PR left behind)
- Branch-name and PR-title injection: `github.head_ref` and `github.event.pull_request.title` in `run:` are attacker-controlled the same way the body is

A stolen CI token is the usual way a single compromised dependency spreads: the malicious install script reads the publish or repo token from the job's environment and uses it to publish further malicious versions or push to other repos. So for every secret, list which jobs can read it and whether any of them runs code from a PR or installs dependencies with scripts enabled.

**Severity:** CRITICAL for `pull_request_target` / `workflow_run` + checkout of PR code / script injection via `${{ github.event.*.body }}`, `head_ref` or the PR title in `run:` steps / a publish or release secret readable by a job that runs PR code. HIGH for unpinned third-party actions / secrets as env vars without masking / cache shared between PR and release jobs / write-scoped default token with no `permissions:` block. MEDIUM for missing CODEOWNERS on workflow files.

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
