# Destructive Command Patterns

> Patterns that trigger a warning in `meow:careful` mode.
> Referenced by: `.claude/skills/meow:careful/SKILL.md` and `.claude/skills/meow:careful/bin/check-careful.sh`
> Update this file when new destructive patterns are discovered in production — and keep the hook in sync.
>
> **Implementation status:** `check-careful.sh` enforces all CRITICAL and HIGH patterns listed below. Production auto-block is active: when `NODE_ENV`, `APP_ENV`, or `ENVIRONMENT` contains `production`/`prod`/`staging`, CRITICAL patterns return `permissionDecision: "block"` (no override) instead of `"ask"`.

---

## Severity Levels

| Level    | Meaning                                                         |
| -------- | --------------------------------------------------------------- |
| CRITICAL | Irreversible, potential data loss or production impact          |
| HIGH     | Reversible but costly to recover from                           |
| MEDIUM   | Dangerous in certain contexts (production, shared environments) |

---

## Blocked Patterns

### File System

| Pattern                               | Example                         | Risk                   | Severity | Safer Alternative                                          |
| ------------------------------------- | ------------------------------- | ---------------------- | -------- | ---------------------------------------------------------- |
| `rm -rf` / `rm -r` / `rm --recursive` | `rm -rf /var/data`              | Recursive delete       | CRITICAL | `mv /var/data /var/data.bak` first, delete after verifying |
| `find ... -delete`                    | `find . -name "*.log" -delete`  | Mass file deletion     | HIGH     | `find ... -print` first to review what would be deleted    |
| `find ... -exec rm`                   | `find . -type f -exec rm {} \;` | Mass file deletion     | HIGH     | `find ... -print` first to review                          |
| `shred` / `wipe`                      | `shred -u secrets.env`          | Irreversible file wipe | CRITICAL | Move to trash, verify, then wipe                           |
| `dd` with disk target                 | `dd if=/dev/zero of=/dev/sda`   | Full disk overwrite    | CRITICAL | No safe alternative — confirm target carefully             |
| `chmod -R 000` / `chmod -R 777`       | `chmod -R 000 /app`             | Permission corruption  | HIGH     | Apply to specific paths, not recursively                   |

### Database (SQL)

| Pattern                              | Example                      | Risk                | Severity | Safer Alternative                               |
| ------------------------------------ | ---------------------------- | ------------------- | -------- | ----------------------------------------------- |
| `DROP TABLE` / `DROP DATABASE`       | `DROP TABLE users;`          | Data loss           | CRITICAL | `RENAME TABLE users TO users_backup` first      |
| `TRUNCATE`                           | `TRUNCATE orders;`           | Data loss           | CRITICAL | `SELECT COUNT(*)` first, then backup            |
| `psql -c "DROP"` / `mysql -e "DROP"` | `psql -c "DROP TABLE users"` | Data loss via CLI   | CRITICAL | Use migration system with rollback              |
| `prisma migrate reset`               | `npx prisma migrate reset`   | Drop + recreate DB  | CRITICAL | Only on local dev; backup first on staging      |
| `rails db:drop` / `rake db:drop`     | `rails db:drop`              | Data loss           | CRITICAL | Use `db:rollback` instead                       |
| `flyway clean`                       | `flyway clean`               | Drop all DB objects | CRITICAL | Only on local dev; never on shared environments |

### Database (NoSQL & Cache)

| Pattern                     | Example              | Risk                         | Severity | Safer Alternative                                                 |
| --------------------------- | -------------------- | ---------------------------- | -------- | ----------------------------------------------------------------- |
| `redis-cli FLUSHALL`        | `redis-cli FLUSHALL` | Wipes entire Redis instance  | CRITICAL | `redis-cli KEYS '*'` to review first; use `FLUSHDB` for single DB |
| `redis-cli FLUSHDB`         | `redis-cli FLUSHDB`  | Wipes current Redis DB       | CRITICAL | Export keys first with `redis-cli --rdb dump.rdb`                 |
| `mongosh db.dropDatabase()` | `db.dropDatabase()`  | Entire MongoDB database loss | CRITICAL | `mongodump` first, then drop                                      |

### Git

| Pattern                                 | Example                   | Risk                    | Severity | Safer Alternative                                       |
| --------------------------------------- | ------------------------- | ----------------------- | -------- | ------------------------------------------------------- |
| `git push --force` / `-f`               | `git push -f origin main` | History rewrite         | CRITICAL | `git push --force-with-lease` (fails if remote changed) |
| `git reset --hard`                      | `git reset --hard HEAD~3` | Uncommitted work loss   | HIGH     | `git stash` before resetting                            |
| `git checkout .` / `git restore .`      | `git checkout .`          | Uncommitted work loss   | HIGH     | `git diff` to review changes first                      |
| `git clean -fd` / `git clean -fdx`      | `git clean -fdx`          | Deletes untracked files | HIGH     | `git clean -n` (dry run) first                          |
| `git filter-branch` / `git filter-repo` | `git filter-branch --all` | Rewrites entire history | CRITICAL | Create a backup branch first                            |
| `git rebase -i` (large range)           | `git rebase -i HEAD~20`   | History rewrite risk    | MEDIUM   | Limit to recent commits; backup branch first            |

### Kubernetes & Containers

| Pattern                                | Example                        | Risk                     | Severity | Safer Alternative                                      |
| -------------------------------------- | ------------------------------ | ------------------------ | -------- | ------------------------------------------------------ |
| `kubectl delete`                       | `kubectl delete pod my-pod`    | Production impact        | HIGH     | `kubectl describe` first to understand dependencies    |
| `kubectl delete namespace`             | `kubectl delete ns production` | Deletes entire namespace | CRITICAL | `kubectl get all -n <namespace>` to audit first        |
| `docker rm -f` / `docker system prune` | `docker system prune -a`       | Container/image loss     | MEDIUM   | `docker ps -a` to review before pruning                |
| `helm uninstall`                       | `helm uninstall my-release`    | K8s app teardown         | HIGH     | `helm get all <release>` to review before uninstalling |

### Cloud & Infrastructure

| Pattern                 | Example                                | Risk                              | Severity | Safer Alternative                                    |
| ----------------------- | -------------------------------------- | --------------------------------- | -------- | ---------------------------------------------------- |
| `terraform destroy`     | `terraform destroy -auto-approve`      | Destroys all infrastructure       | CRITICAL | `terraform plan -destroy` to review before executing |
| `aws s3 rm --recursive` | `aws s3 rm s3://my-bucket --recursive` | Deletes entire S3 bucket contents | CRITICAL | `aws s3 ls` to review; enable versioning first       |
| `gcloud ... delete`     | `gcloud sql instances delete my-db`    | Cloud resource loss               | CRITICAL | Check dependencies via console before deleting       |

---

## Safe Exceptions (No Warning)

These patterns are explicitly allowed without warning — they target disposable build artifacts:

### Build & Dependency Caches

- `rm -rf node_modules`
- `rm -rf .next`
- `rm -rf dist`
- `rm -rf build`
- `rm -rf .turbo`
- `rm -rf coverage`
- `rm -rf __pycache__`
- `rm -rf .cache`
- `rm -rf .gradle`
- `rm -rf target` _(Rust / Java / Maven)_
- `rm -rf vendor` _(PHP / Go)_
- `rm -rf Pods` _(iOS CocoaPods)_
- `rm -rf .venv` / `venv` _(Python virtualenv)_

### Container Housekeeping

- `docker rm $(docker ps -aq)` _(removes stopped containers only)_
- `docker rmi $(docker images -f "dangling=true" -q)` _(dangling images only)_

---

## How the Hook Detects Patterns

The `check-careful.sh` script reads the Bash tool's `command` field from the tool input JSON. It matches against the patterns above using regex, then returns `permissionDecision: "ask"` with a warning message if a match is found. The user can override each warning individually.

Pattern matching is command-scoped — the hook checks the actual bash command string, not file content. This prevents false positives on source code that mentions these commands in comments or strings.

### Override Mechanism

When the hook triggers a warning, the user is prompted to confirm. Overrides are logged to `.claude/memory/security-log.md` with timestamp and command for audit trail.

---

## Environment-Aware Blocking

Some patterns should be blocked more strictly when running in production-like environments. The hook checks the following environment indicators before deciding severity:

```bash
# Indicators of production context (always block, no override)
NODE_ENV=production
APP_ENV=production | staging
ENVIRONMENT=prod | production
```

On detection of a production context, CRITICAL patterns return `permissionDecision: "block"` (no override) instead of `"ask"`.

---

## Gotchas

> Update this section when Claude hits new edge cases in practice.

- **Shell aliases bypass detection**: if the user has `alias del='rm -rf'`, the hook sees `del` not `rm -rf` → false negative. Document project-specific dangerous aliases in `.claude/rules/`.

- **Multi-line commands may not match**: a command split across lines as `rm -rf \` + `/data` may not match a single-line regex. The hook should join continuation lines before matching.

- **Subshell execution can bypass**: `$(rm -rf /data)` embedded in a larger command may not trigger if regex only checks the outer command. Match against the full resolved command string where possible.

- **Safe exceptions can be overly broad**: `rm -rf dist` is safe locally but dangerous if `dist/` contains production artifacts currently being served. Consider flagging when inside a CI/CD environment variable context.

- **`git rebase -i` is context-dependent**: rebasing 2 commits locally is safe; rebasing 50 commits on a shared branch is destructive. The current pattern flags all `rebase -i` equally — consider adding a commit-count heuristic.

- **`terraform destroy` without `-auto-approve`**: the current pattern blocks `terraform destroy` entirely, but without `-auto-approve` it always prompts interactively. Consider only blocking the `-auto-approve` variant.

- **Docker prune scope**: `docker system prune` without `-a` only removes dangling resources and is generally safe. `docker system prune -a` removes ALL unused images and is destructive. The pattern should distinguish between the two.
