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
  '.claude/hooks/privacy-block.cjs': [
    'MEOWKIT_PROJECT_DIR',
    'CLAUDE_PROJECT_DIR',
    'CURSOR_PROJECT_DIR',
  ],
  '.claude/hooks/pre-ship.cjs': [
    'MEOWKIT_PROJECT_DIR',
    'CLAUDE_PROJECT_DIR',
    'CURSOR_PROJECT_DIR',
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
    for (const entry of Object.keys(ALLOWED)) {
      const { files } = requireGraph(entry);
      for (const file of files) {
        expect(file.source, `${file.rel} (reached from ${entry}) loads the project config`)
          .not.toMatch(/read-config|config-rules|yaml-subset|js-yaml/);
      }
    }
  });

  it('never names the committed config on a safety path', () => {
    for (const entry of Object.keys(ALLOWED)) {
      const { files } = requireGraph(entry);
      for (const file of files) expect(file.source, `${file.rel} (reached from ${entry})`).not.toMatch(/config\.yaml/);
    }
  });

  it('reads no dotenv file on any safety path', () => {
    for (const entry of Object.keys(ALLOWED)) {
      const { files } = requireGraph(entry);
      for (const file of files) {
        expect(file.source, `${file.rel} (reached from ${entry})`).not.toMatch(/\.meowkit\/\.env|load-dotenv/);
      }
    }
  });

  it('never reads the profile variables on a safety path', () => {
    // The profile selects speed trade-offs elsewhere; the privacy block and the ship
    // check run the same under every profile.
    for (const entry of Object.keys(ALLOWED)) {
      const { files } = requireGraph(entry);
      for (const file of files) {
        expect(file.source, `${file.rel} (reached from ${entry})`).not.toMatch(/MEOWKIT_HOOK_PROFILE|MEOW_HOOK_PROFILE/);
      }
    }
  });
});
