# /validate — Deterministic Validation (Non-LLM)

## Usage

```
/validate
```

## Behavior

Runs deterministic validation scripts that check for anti-patterns WITHOUT using the LLM. Use this when you want certainty, not AI judgment.

### Execution Steps

1. **Run validation scripts.** Execute the following Python scripts:
   - `.claude/scripts/validate.py` — checks for structural anti-patterns, naming convention violations, missing required files, and configuration issues.
   - `.claude/scripts/security-scan.py` — checks for security anti-patterns using pattern matching (regex-based, not LLM-based).

2. **Collect results.** Each script outputs machine-verifiable results in a structured format: file path, line number, rule violated, severity.

3. **Print results.** Display all findings. These are deterministic — running the same scripts on the same code will always produce the same output.

### Why This Exists

LLM-based review (`/mk:review`, `/mk:audit`) is powerful but non-deterministic. `/mk:validate` provides a complementary layer of checks that are:
- **Reproducible**: same input always produces same output.
- **Fast**: no API calls, runs locally.
- **Auditable**: the rules are visible in the script source code.

### Output

Machine-verifiable results from `validate.py` and `security-scan.py`. Each finding includes: file path, line number, rule violated, and severity.
