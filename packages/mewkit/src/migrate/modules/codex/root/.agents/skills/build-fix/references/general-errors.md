# General Build Error Reference

Framework-agnostic build error patterns. Use when language is unknown or error doesn't match
TypeScript or Python references.

## Contents

- [Dependency Errors](#dependency-errors)
  - [Missing dependency](#missing-dependency)
  - [Version mismatch](#version-mismatch)
- [Environment Errors](#environment-errors)
  - [Missing environment variable](#missing-environment-variable)
  - [Permission denied](#permission-denied)
  - [Port already in use](#port-already-in-use)
- [Build Tool Errors](#build-tool-errors)
  - [Out of memory](#out-of-memory)
  - [Circular dependency](#circular-dependency)
  - [Stale cache](#stale-cache)
- [Go-Specific](#go-specific)
  - [cannot find package](#cannot-find-package)
  - [undefined: X](#undefined-x)
- [Rust-Specific](#rust-specific)
  - [error[E0432] unresolved import](#errore0432-unresolved-import)
  - [error[E0308] mismatched types](#errore0308-mismatched-types)


## Dependency Errors

### Missing dependency

**Symptoms:** `command not found`, `module not found`, `cannot resolve`, `package not found`
**Class:** auto-fixable
**Fix:**
1. Identify package manager: `package.json` → npm/yarn/pnpm/bun; `go.mod` → go; `Cargo.toml` → cargo
2. Install missing package with the appropriate command
3. Re-run build

```
npm install <package>
go get <module>
cargo add <crate>
pip install <package>
```

### Version mismatch

**Symptoms:** `peer dependency conflict`, `requires X but found Y`, `incompatible version`
**Class:** suggest-with-confidence
**Fix:**
1. Check lockfile for pinned version vs required range
2. Update the conflicting package: `npm update <package>`
3. If peer conflict: install exact required version explicitly
4. Check for breaking changes in the version diff before upgrading major versions

## Environment Errors

### Missing environment variable

**Symptoms:** `undefined is not a valid`, `process.env.X is undefined`, `KeyError: 'X'`
**Class:** suggest-with-confidence
**Fix:**
1. Check `.env.example` or docs for required variables
2. Add missing variable to `.env` (never commit `.env` to git)
3. Verify the variable name matches exactly (case-sensitive)

### Permission denied

**Symptoms:** `EACCES`, `Permission denied`, `cannot write to`
**Class:** suggest-with-confidence
**Fix:**
1. Check file/directory ownership: `ls -la <path>`
2. For build output dirs: `chmod 755 <dir>`
3. For scripts: `chmod +x <script.sh>`
4. Never use `sudo` for package installs — fix the permissions or use a user-local install

### Port already in use

**Symptoms:** `EADDRINUSE`, `address already in use`, `port X is already in use`
**Class:** auto-fixable
**Fix:**
1. Find process: `lsof -i :<port>` or `ss -tulpn | grep <port>`
2. Kill it: `kill -9 <pid>`
3. Or change the port in the project config

## Build Tool Errors

### Out of memory

**Symptoms:** `JavaScript heap out of memory`, `Killed`, `OOM`
**Class:** suggest-with-confidence
**Fix:**
1. Node.js: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`
2. Check for memory leaks in build plugins (circular deps, huge asset imports)
3. Split build into smaller chunks if possible

### Circular dependency

**Symptoms:** `circular dependency detected`, `circular import`
**Class:** report-only
**Fix:** Circular deps require architectural change — cannot auto-fix safely.
Report: identify the cycle, suggest extracting shared code to a third module both can import.

### Stale cache

**Symptoms:** Build worked before but fails now with no code changes; errors reference deleted files
**Class:** auto-fixable
**Fix:**
1. Clear build cache: `rm -rf .cache dist .next out`
2. For npm: `npm ci` (clean install from lockfile)
3. Re-run build

## Go-Specific

### cannot find package

**Message:** `cannot find package "X" in any of:`
**Class:** auto-fixable
**Fix:** `go get X` — adds to `go.mod` and downloads

### undefined: X

**Message:** `undefined: X`
**Class:** suggest-with-confidence
**Fix:** Check package name vs import path; verify the symbol is exported (starts with uppercase in Go)

## Rust-Specific

### error[E0432] unresolved import

**Class:** auto-fixable
**Fix:** Add to `Cargo.toml` dependencies, then `cargo build`

### error[E0308] mismatched types

**Class:** suggest-with-confidence
**Fix:** Add explicit type conversion or fix the return type annotation