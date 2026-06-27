---
name: cli-tool
version: 1.0.0
applies_to: [cli]
description: Composition for command-line tools. UX matters more than visual design.
rubrics:
  - name: functionality
    weight: 0.40
  - name: product-depth
    weight: 0.25
  - name: code-quality
    weight: 0.15
  - name: ux-usability
    weight: 0.20
---

# Preset: cli-tool

Composition for command-line tools — single binaries, npm CLIs, Python scripts, shell utilities.

## When to Use

- Spec produces a CLI binary or executable script
- Output is text-based (no GUI)
- Verification is via terminal invocation

## Weight Rationale

- **functionality (0.40)** — exit codes, argument parsing, output format must work
- **product-depth (0.25)** — feature coverage of `--help` text vs. spec
- **ux-usability (0.20)** — for CLIs, "first-time user can use it without docs" is critical (good `--help`, helpful errors, sensible defaults)
- **code-quality (0.15)** — maintainability

Visual rubrics excluded. craft is folded into ux-usability for CLIs (microcopy, error messages, help text).

Weights sum to 1.00.

## CLI-Specific UX Notes

For CLI tools, ux-usability evaluation should specifically check:
- `--help` is comprehensive and example-driven
- Errors print actionable next steps, not just stack traces
- Exit codes are documented (`0` success, `1` user error, `2` system error)
- Sensible defaults (works with zero flags for the common case)
- Graceful degradation when stdin/stdout is piped

## Hard-Fail Inheritance

functionality FAIL is most common (binary doesn't run, wrong exit code, broken arg parsing). ux-usability has hard_fail_threshold=WARN, so it only triggers FAIL on egregious violations (no help text, errors trap user).
