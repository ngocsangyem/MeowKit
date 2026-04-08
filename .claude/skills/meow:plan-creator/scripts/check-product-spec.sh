#!/usr/bin/env bash
#
# check-product-spec.sh — Structural validator for product-level plans.
#
# Replaces the inline grep self-check from step-03a-product-spec.md §3a.5.
# Per lessons-build-skill.md "Store Scripts" — script form is the reliable enforcement layer.
#
# Usage:  check-product-spec.sh <path-to-plan.md>
# Exit:   0 on PASS, 1 on FAIL (with diagnostics on stderr)
#
# POSIX-compatible (works on macOS BSD grep + GNU grep). Tested on Bash 3.2+.

set -u

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <path-to-plan.md>" >&2
  exit 2
fi

plan="$1"

if [ ! -f "$plan" ]; then
  echo "FAIL: plan file not found: $plan" >&2
  exit 2
fi

fail=0

# 1. Forbidden file paths and source extensions
if grep -En '(src/|lib/|\.tsx?|\.vue|\.py|\.swift|\.svelte|\.astro|\.js|\.css|\.html)' "$plan"; then
  echo "FAIL: file paths in product-level plan" >&2
  fail=1
fi

# 2. Forbidden class / interface declarations
if grep -En '(class|interface)[[:space:]]+[A-Z][A-Za-z0-9]+' "$plan"; then
  echo "FAIL: class names in product-level plan" >&2
  fail=1
fi

# 3. Forbidden SQL DDL
if grep -Eni '(create table|alter table|primary key|foreign key)' "$plan"; then
  echo "FAIL: SQL DDL in product-level plan" >&2
  fail=1
fi

# 4. Feature count must be >= 8 (count "### N." headings)
feature_count=$(grep -c '^### [0-9]' "$plan" || true)
if [ "$feature_count" -lt 8 ]; then
  echo "FAIL: only $feature_count features (minimum 8)" >&2
  fail=1
fi

# 5. Required sections must exist
for section in "## Product Vision" "## Features" "## Design Language" "## AI Integration Opportunities" "## Out of Scope" "## Success Criteria"; do
  if ! grep -qF "$section" "$plan"; then
    echo "FAIL: missing required section: $section" >&2
    fail=1
  fi
done

# 6. User story format check — every feature should have at least one "As a ... I want ... so that"
us_count=$(grep -Ec '^- As (a|an) [a-zA-Z]+' "$plan" || true)
min_us=$((feature_count * 2))
if [ "$us_count" -lt "$min_us" ]; then
  echo "FAIL: only $us_count user stories (need >= $min_us = 2 per feature)" >&2
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PRODUCT_SPEC_COMPLETE: $feature_count features, $us_count user stories"
  exit 0
fi

exit 1
