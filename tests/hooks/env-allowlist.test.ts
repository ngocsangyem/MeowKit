// env-allowlist.test.ts — the environment a safety guard may consult is closed.
//
// "No test-only switch can turn the guard off" is an impression, not a test:
// the next variable added is exactly the one nobody thought to look for. So the
// set is written out here, per entrypoint, and the proof is a diff against the
// list rather than a judgement about whether any particular read "skips the
// check".
//
// Adding a variable to a guard therefore has to be done twice — in the code and
// here — which is the point. A single-sided change fails.

import { describe, expect, it } from 'vitest';

import { envReads, requireGraph } from './lib/require-graph';

/** What each entrypoint and its libraries may read, and nothing else. */
const ALLOWED: Record<string, string[]> = {
  '.claude/hooks/gate-enforcement.cjs': [
    // The project root every rule below is relative to.
    'CLAUDE_PROJECT_DIR',
    // Downgrades the approval check to presence only, announced on stderr.
    'MEOWKIT_GATE1_PRESENCE_ONLY',
    // Density modes that skip the contract step by policy and log the bypass.
    'MEOWKIT_AUTOBUILD_MODE',
  ],
  '.claude/hooks/privacy-block.cjs': [
    'CLAUDE_PROJECT_DIR',
  ],
  '.claude/hooks/pre-ship.cjs': [
    'CLAUDE_PROJECT_DIR',
    // Selects the build/lint/test block only — never the structural ship proof.
    'MEOWKIT_HOOK_PROFILE',
    'MEOW_HOOK_PROFILE',
    // Path of the CLI the store lint runs.
    'MEOWKIT_CLI',
  ],
};

describe('safety entrypoints read a closed set of environment variables', () => {
  for (const [entry, allowed] of Object.entries(ALLOWED)) {
    it(`${entry} reads nothing beyond its declared set`, () => {
      const { files } = requireGraph(entry);
      const reads = new Set<string>();
      for (const file of files) for (const name of envReads(file.source)) reads.add(name);

      const unexpected = [...reads].filter((name) => !allowed.includes(name)).sort();
      expect(unexpected, `${entry} reads undeclared variables`).toEqual([]);
    });

    it(`${entry} declares nothing it does not read`, () => {
      const { files } = requireGraph(entry);
      const reads = new Set<string>();
      for (const file of files) for (const name of envReads(file.source)) reads.add(name);

      // A stale entry here would widen the allowlist without widening the code,
      // which is how a closed set quietly stops being closed.
      const unused = allowed.filter((name) => !reads.has(name)).sort();
      expect(unused, `${entry} declares unread variables`).toEqual([]);
    });
  }

  it('reads no project config on any safety path', () => {
    // The project config is committed, so it is editable by anyone who can open
    // a pull request. Validating what a guard reads from it would still leave
    // the guard reading it; the property worth having is that it cannot, and
    // this is the same closed-set shape that already proves it for environment
    // variables and dotenv files.
    //
    // The gate's own escape hatch is the one exception and is deliberately NOT
    // the general loader: it has a dedicated single-key reader whose only
    // vocabulary is `gate1PresenceOnly`, in the USER file outside the repo.
    for (const entry of Object.keys(ALLOWED)) {
      const { files } = requireGraph(entry);
      for (const file of files) {
        expect(file.source, `${file.rel} (reached from ${entry}) loads the project config`)
          .not.toMatch(/read-config|config-rules|yaml-subset|js-yaml/);
      }
    }
  });

  it('reaches the committed config only through the single-key hatch reader', () => {
    // `.meowkit/config.yaml` may be NAMED on a safety path exactly once — by the
    // hatch reader, for the user-scope file. Any other mention would mean a
    // second, unreviewed way in.
    const mentions: string[] = [];
    for (const entry of Object.keys(ALLOWED)) {
      const { files } = requireGraph(entry);
      for (const file of files) {
        if (/config\.yaml|'config\.yaml'/.test(file.source)) mentions.push(file.rel);
      }
    }
    expect([...new Set(mentions)].sort()).toEqual(['.claude/hooks/lib/gate1-hatch.cjs']);
  });

  it('reads no dotenv file on any safety path', () => {
    for (const entry of Object.keys(ALLOWED)) {
      const { files } = requireGraph(entry);
      for (const file of files) {
        expect(file.source, `${file.rel} (reached from ${entry})`).not.toMatch(/\.meowkit\/\.env|load-dotenv/);
      }
    }
  });

  it('never reads the profile variables on a path that could skip a gate', () => {
    // The profile selects speed trade-offs. Two entrypoints assigned it at the
    // top and never read it again; dropping those assignments is what keeps the
    // set honest, so assert they stayed dropped.
    for (const entry of ['.claude/hooks/gate-enforcement.cjs', '.claude/hooks/privacy-block.cjs']) {
      const { files } = requireGraph(entry);
      for (const file of files) {
        expect(file.source, `${file.rel} (reached from ${entry})`).not.toMatch(/MEOWKIT_HOOK_PROFILE|MEOW_HOOK_PROFILE/);
      }
    }
  });
});
