# CI/CD Fix Workflow

For GitHub Actions, CI pipeline, and deployment failures.

## Steps

### Step 1: Identify Failure
- Read CI logs (use `gh run view` or check `.github/workflows/`)
- Identify which job/step failed
- Classify: config error, dependency issue, test failure, build failure, deploy failure

### Step 2: Reproduce Locally
- Run the failing command locally
- Compare local vs CI environment (Node version, env vars, OS)

### Step 3: Fix
- Config errors: fix workflow YAML
- Dependency issues: update lockfile, pin versions
- Test failures: route to `references/workflow-test.md`
- Build failures: fix source code, check for platform-specific issues
- Deploy failures: check credentials, service connectivity

### Step 4: Verify
Run the full CI workflow locally before pushing:
```
Agent("Bash", "Run the full test + build + lint pipeline locally")
```

### Step 5: Review & Commit
Use reviewer agent for quick review, then shipper for PR.

## Common CI Patterns
- Missing env vars: check secrets configuration
- Version mismatch: pin Node/Python versions in workflow
- Cache issues: clear and rebuild CI cache
- Timeout: increase job timeout or optimize slow steps
