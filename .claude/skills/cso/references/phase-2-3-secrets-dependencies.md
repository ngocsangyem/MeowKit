# Phase 2: Secrets Archaeology

Scan git history for leaked credentials, check tracked `.env` files, find CI configs with inline secrets.

**Git history — known secret prefixes:**
```bash
git log -p --all -S "AKIA" --diff-filter=A -- "*.env" "*.yml" "*.yaml" "*.json" "*.toml" 2>/dev/null
git log -p --all -S "sk-" --diff-filter=A -- "*.env" "*.yml" "*.json" "*.ts" "*.js" "*.py" 2>/dev/null
git log -p --all -G "ghp_|gho_|github_pat_" 2>/dev/null
git log -p --all -G "xoxb-|xoxp-|xapp-" 2>/dev/null
git log -p --all -G "password|secret|token|api_key" -- "*.env" "*.yml" "*.json" "*.conf" 2>/dev/null
```

**.env files tracked by git:**
```bash
git ls-files '*.env' '.env.*' 2>/dev/null | grep -v '.example\|.sample\|.template'
grep -q "^\.env$\|^\.env\.\*" .gitignore 2>/dev/null && echo ".env IS gitignored" || echo "WARNING: .env NOT in .gitignore"
```

**CI configs with inline secrets (not using secret stores):**
```bash
for f in .github/workflows/*.yml .github/workflows/*.yaml .gitlab-ci.yml .circleci/config.yml; do
  [ -f "$f" ] && grep -n "password:\|token:\|secret:\|api_key:" "$f" | grep -v '\${{' | grep -v 'secrets\.'
done 2>/dev/null
```

**Severity:** CRITICAL for active secret patterns in git history (AKIA, sk_live_, ghp_, xoxb-). HIGH for .env tracked by git, CI configs with inline credentials. MEDIUM for suspicious .env.example values.

**FP rules:** Placeholders ("your_", "changeme", "TODO") excluded. Test fixtures excluded unless same value in non-test code. Rotated secrets still flagged (they were exposed). `.env.local` in `.gitignore` is expected.

**Diff mode:** Replace `git log -p --all` with `git log -p <base>..HEAD`.

# Phase 3: Dependency Supply Chain

Goes beyond `npm audit`. Checks actual supply chain risk.

**Package manager detection:**
```bash
[ -f package.json ] && echo "DETECTED: npm/yarn/bun"
[ -f Gemfile ] && echo "DETECTED: bundler"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "DETECTED: pip"
[ -f Cargo.toml ] && echo "DETECTED: cargo"
[ -f go.mod ] && echo "DETECTED: go"
```

**Standard vulnerability scan:** Run whichever package manager's audit tool is available. Each tool is optional — if not installed, note it in the report as "SKIPPED — tool not installed" with install instructions. This is informational, NOT a finding. The audit continues with whatever tools ARE available.

**Install scripts in production deps (supply chain attack vector):** For Node.js projects with hydrated `node_modules`, check production dependencies for `preinstall`, `postinstall`, or `install` scripts.

**Lockfile integrity:** Check that lockfiles exist AND are tracked by git, and that CI installs from them (`npm ci`, `pnpm install --frozen-lockfile`, `uv sync --locked`, `cargo --locked`) rather than re-resolving.

**Compromised releases (a CVE list does not cover these):** a hijacked maintainer account publishes a malicious version of a legitimate package, and it is live for hours before an advisory exists. Check each of these:

- **Release-age window.** Is a minimum age set so a fresh release is not installed the day it is published? pnpm: `minimumReleaseAge` (minutes) in `pnpm-workspace.yaml`; npm 11.10+: `min-release-age` (days) in `.npmrc`; uv: `exclude-newer` with a relative duration under `[tool.uv]`. Lockfile installs are unaffected, so this guards updates and new additions.
- **Install-time code.** Lifecycle scripts (`preinstall`, `install`, `postinstall`, `prepare`) in any dependency, not only production ones, since a dev dependency's script runs on the developer's machine and in CI with their tokens. Is `ignore-scripts` (or pnpm's allow-list of packages permitted to build) in use? For Python: `setup.py` in sdist-only dependencies and `*.pth` files in site-packages, both of which run code without an import.
- **Remote code with no pinned version.** `npx <pkg>`, `pnpm dlx`, `bunx`, `uvx`, `pipx run`, a download piped to a shell, and `go run pkg@latest` in package scripts, shell scripts, CI steps, git hooks, editor/agent hook scripts and docs the team copies from. Each fetches whatever is newest at run time. Without a terminal `npx` installs a missing package with no prompt, so a bare `npx <tool>` in a hook or CI step is an unreviewed install. Require a pinned version, the local binary, or `npx --no-install`.
- **Name risk.** For each dependency added in the audit window: does the name exist on the registry, is it the package the code means (`tsc` is not `typescript`), and is it old and widely used enough to be the real one? A name an AI assistant suggested and nobody looked up is a finding until checked. Private package names must be scoped and bound to the private registry, or a public package of the same name wins.
- **Non-registry sources.** `git+`, `http(s):` tarball, and `file:` dependencies, and a lockfile `resolved` URL that points outside the expected registry.
- **Known-bad versions.** When the user names an incident, or the audit window overlaps one, search the lockfile for the affected package and version range and report presence or absence explicitly. Take the range from the advisory database (`npm audit`, `pip-audit`, `cargo audit`, `osv-scanner` when installed), not from recalled version numbers.
- **Publishing credentials.** If the repo publishes packages: long-lived registry tokens in CI secrets versus OIDC trusted publishing, whether publish needs 2FA, and whether releases carry provenance. A stolen publish token is how one compromised machine becomes a compromised package for every downstream user.

**Severity:** CRITICAL for known CVEs (high/critical) in direct deps / a lockfile entry inside a known-compromised version range. HIGH for install scripts in prod deps / missing lockfile / unpinned remote code in CI, hooks or release scripts / a dependency name that does not resolve to the intended package / long-lived publish token readable by PR-triggered jobs. MEDIUM for abandoned packages / medium CVEs / lockfile not tracked / no release-age window / install scripts in dev deps / CI not installing from the lockfile.

**FP rules:** devDependency CVEs are MEDIUM max. `node-gyp`/`cmake` install scripts expected (MEDIUM not HIGH). No-fix-available advisories without known exploits excluded. Missing lockfile for library repos (not apps) is NOT a finding.
