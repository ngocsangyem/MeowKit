# Skill: Deterministic Validation Scripts

**Purpose:** Run real, deterministic checks that do not depend on LLM judgment. These scripts provide ground-truth validation for security, code quality, and correctness.

## When to Use

Run validation scripts at two mandatory points:
1. **Phase 4 (Review Gate)** — before a change is approved for shipping
2. **Pre-Ship** — immediately before creating a PR or deploying

Also run on-demand whenever you want to verify code quality without relying on subjective assessment.

---

## Available Scripts

### `.claude/scripts/validate.py`

General validation script that checks code quality and correctness.

**What it checks:**
- Type errors (runs the type checker for the project's language)
- Lint violations (runs the project's linter)
- Test suite passes (runs all tests)
- Build succeeds (runs the build command)
- No TODO/FIXME/HACK without linked issue
- No debug statements left in code (`console.log`, `print`, `debugger`)

**How to run:**
```bash
.claude/skills/.venv/bin/python3 .claude/scripts/validate.py
```

**Exit codes:**
- `0` — all checks passed
- `1` — one or more checks failed (details in output)

### `.claude/scripts/security-scan.py`

Security-focused validation. See `review/security-checklist.md` for the full list of checks.

**What it checks:**
- No secrets in code (API keys, tokens, passwords)
- No raw SQL with string interpolation
- No `eval()` or equivalent unsafe execution
- Dependencies have no known critical vulnerabilities
- Environment variables accessed safely
- Auth guards present on protected routes

**How to run:**
```bash
.claude/skills/.venv/bin/python3 .claude/scripts/security-scan.py
```

**Exit codes:**
- `0` — no security issues found
- `1` — security issues found (details in output, each with severity)

---

## Why Deterministic Validation Matters

LLMs can miss issues that pattern-matching scripts catch reliably:
- A human or LLM might overlook a `console.log` buried in a large diff
- A script will always find it
- A script applies rules consistently across every run
- A script does not hallucinate that tests pass when they fail

These scripts are the **source of truth**. If the script says FAIL, the change does not ship — regardless of what any LLM review says.

---

## How to Extend

To add a new check to `validate.py`:

1. Create a new check function:
```python
def check_no_hardcoded_urls():
    """Ensure no hardcoded production URLs in source code."""
    issues = []
    for file in get_source_files():
        content = read_file(file)
        if re.search(r'https?://(?:api|www)\.production\.com', content):
            issues.append(f"{file}: contains hardcoded production URL")
    return issues
```

2. Register it in the `CHECKS` list:
```python
CHECKS = [
    check_types,
    check_lint,
    check_tests,
    check_build,
    check_no_debug_statements,
    check_no_hardcoded_urls,  # new check
]
```

3. Run the script to verify the new check works.

To add a new security check, follow the same pattern in `security-scan.py`.

---

## Integration with Workflow

```
[Development] → [Unit Tests] → [Validation Scripts] → [Review] → [Security Scan] → [Ship]
                                      ↑                                    ↑
                                  Phase 4 gate                       Pre-ship gate
```

Both gates must pass with exit code `0` before proceeding. No exceptions.
