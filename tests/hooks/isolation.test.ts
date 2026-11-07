// isolation.test.ts — a safety guard must not be able to take anything else
// down with it, or be taken down by anything else.
//
// Three separate claims, each checked from the source rather than from a run:
//
//   1. The guards share no code with the fail-open observer path. An observer is
//      allowed to crash; a guard is not, and a guard that imported the
//      dispatcher or a handler would inherit the observer's failure mode.
//   2. No guard opens a socket. A write guard has no reason to reach the network,
//      and a guard that could would be a channel out of the process that reads
//      every file being written.
//   3. Every child process a guard starts is one of a named few, and none of them
//      is a shell. The shell dependency is the thing being removed; a single
//      leftover `sh` call site puts it back on hosts that have no shell.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, commandLiterals, literalTarget, requireGraph, spawnSites } from './lib/require-graph';

const ENTRYPOINTS = [
  '.claude/hooks/gate-enforcement.cjs',
  '.claude/hooks/privacy-block.cjs',
  '.claude/hooks/pre-ship.cjs',
];

const FORBIDDEN_MODULES = ['http', 'https', 'net', 'dgram', 'tls'];

/**
 * Executables a guard may start.
 *
 * `git` reads what a command would ship. The resolved kit CLI lints the team
 * memory store — the only reason a path variable for it exists. `node` runs the
 * two in-repo validators that own the evidence and coverage formats. The rest
 * are the project's own build, lint and test commands, which the ship guard has
 * always run and which the ship decision does not depend on.
 */
const ALLOWED_COMMANDS = ['git', 'mewkit', 'npm', 'npx', 'swift', 'swiftlint', 'pytest', 'ruff', 'flake8'];

/** The only scripts a guard may hand to `node`. */
const ALLOWED_NODE_TARGETS = [
  '.claude/scripts/validate-workflow-evidence.cjs',
  '.claude/scripts/validate-review-coverage.cjs',
];

/** Host credential surfaces no hook may touch. Exact tokens, so a rules handler named for security does not trip it. */
const CREDENTIAL_TOKENS = ['.credentials', 'keychain', 'security find-generic-password'];

describe('safety entrypoints are isolated from the observer path', () => {
  for (const entry of ENTRYPOINTS) {
    it(`${entry} reaches no dispatcher, registry or handler`, () => {
      const { files } = requireGraph(entry);
      const reached = files.map((f) => f.rel);
      for (const rel of reached) {
        expect(rel, `${entry} reaches ${rel}`).not.toMatch(/dispatch\.cjs$|handlers\.json$|\/handlers\//);
      }
      // Everything reached must live in the guard's own library directory.
      for (const rel of reached.slice(1)) {
        expect(rel.startsWith('.claude/hooks/lib/'), `${entry} reaches ${rel} outside lib/`).toBe(true);
      }
    });

    it(`${entry} loads no networking module`, () => {
      const { builtins } = requireGraph(entry);
      for (const mod of FORBIDDEN_MODULES) {
        expect(builtins.has(mod), `${entry} loads ${mod}`).toBe(false);
      }
    });
  }
});

describe('every child process a safety entrypoint starts is accounted for', () => {
  const allFiles = ENTRYPOINTS.flatMap((e) => requireGraph(e).files);
  const uniqueFiles = [...new Map(allFiles.map((f) => [f.rel, f])).values()];
  const sites = spawnSites(uniqueFiles);

  it('starts at least one child process, so the check has a subject', () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it('targets no shell and no shell script', () => {
    for (const site of sites) {
      const target = literalTarget(site.target);
      if (target !== null) {
        expect(['bash', 'sh', '/bin/bash', '/bin/sh'], `${site.rel} spawns ${target}`).not.toContain(target);
        expect(target, `${site.rel} spawns a shell script`).not.toMatch(/\.sh$/);
      }
    }
    for (const file of uniqueFiles) {
      // Catches an indirect spelling too: a shell named anywhere in a guard's
      // source is a shell it can reach, however the call is written.
      expect(file.source, `${file.rel} names a shell script`).not.toMatch(/['"][\w./-]*\.sh['"]/);
      expect(file.source, `${file.rel} names a shell binary`).not.toMatch(/['"](bash|sh|\/bin\/bash|\/bin\/sh)['"]/);
    }
  });

  it('never enables shell interpretation on a spawn', () => {
    for (const file of uniqueFiles) {
      expect(file.source, `${file.rel} sets shell: true`).not.toMatch(/shell:\s*true/);
    }
  });

  it('passes only this node binary and the two in-repo validators to node', () => {
    const nodeSites = sites.filter((s) => s.target.includes('execPath'));
    expect(nodeSites.length, 'the node-run validators are reachable').toBeGreaterThan(0);
    const named = uniqueFiles
      .flatMap((f) => commandLiterals(f.source))
      .filter((lit) => lit.startsWith('.claude/scripts/'));
    for (const target of new Set(named)) {
      expect(ALLOWED_NODE_TARGETS, `node target ${target}`).toContain(target);
    }
  });

  it('has exactly the four reviewed call sites', () => {
    // Enumerated, not counted. Adding a child process anywhere a guard can reach
    // fails here and has to be justified, which is the only way an allowlist of
    // executables stays meaningful when three of the four targets are variables.
    const actual = sites.map((s) => `${s.rel} ${s.fn}(${s.target})`).sort();
    expect(actual).toEqual(
      [
        // Reads what a command would ship. History only; never rewrites it.
        ".claude/hooks/lib/gate2-change-set.cjs spawnSync('git')",
        // Runs the two in-repo validators that own the evidence formats.
        '.claude/hooks/lib/gate2-structural-checks.cjs spawnSync(process.execPath)',
        // Runs the resolved kit CLI to lint the team memory store.
        '.claude/hooks/lib/memory-store-lint.cjs spawnSync(cli)',
        // Runs the project's own build, lint and test commands.
        '.claude/hooks/lib/preship-checks.cjs spawnSync(command)',
      ].sort(),
    );
  });

  it('resolves the store-lint target to the kit CLI and nothing else', () => {
    const source = uniqueFiles.find((f) => f.rel.endsWith('memory-store-lint.cjs'))?.source ?? '';
    expect(source, 'the local install path').toContain('./node_modules/.bin/mewkit');
    const bareNames = commandLiterals(source).filter((lit) => /^[a-z][a-z0-9-]*$/.test(lit));
    expect(bareNames.filter((n) => ALLOWED_COMMANDS.includes(n)), 'resolved CLI names').toEqual(['mewkit']);
  });

  it('resolves the build, lint and test targets to the declared commands', () => {
    const source = uniqueFiles.find((f) => f.rel.endsWith('preship-checks.cjs'))?.source ?? '';
    // Each check names its executable as the second argument of its runner call.
    const named = new Set<string>();
    for (const m of source.matchAll(/\brun(?:Check|IfInstalled)\(\s*'[^']*',\s*'([^']+)'/g)) named.add(m[1]);
    const unexpected = [...named].filter((c) => !ALLOWED_COMMANDS.includes(c)).sort();
    expect(unexpected, 'build/lint/test commands outside the allowlist').toEqual([]);
    expect(named.size, 'the check block has a subject').toBeGreaterThan(0);
  });
});

describe('no hook source touches host credentials', () => {
  function sourcesUnder(dir: string): Array<{ rel: string; source: string }> {
    const out: Array<{ rel: string; source: string }> = [];
    const abs = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(abs)) return out;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!/\.(cjs|mjs|js)$/.test(entry.name)) continue;
      const parent = String(entry.parentPath ?? abs);
      const file = path.join(parent, entry.name);
      out.push({ rel: path.relative(REPO_ROOT, file), source: fs.readFileSync(file, 'utf8') });
    }
    return out;
  }

  const sources = [
    ...sourcesUnder('.claude/hooks'),
    ...sourcesUnder('.claude/skills/careful/bin'),
    ...sourcesUnder('.claude/skills/freeze/bin'),
    ...sourcesUnder('.claude/skills/investigate/bin'),
  ];

  it('scans a non-empty set of hook sources', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  for (const token of CREDENTIAL_TOKENS) {
    it(`contains no "${token}"`, () => {
      const offenders = sources.filter((s) => s.source.includes(token)).map((s) => s.rel);
      expect(offenders, `files naming ${token}`).toEqual([]);
    });
  }
});
