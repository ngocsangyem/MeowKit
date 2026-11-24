#!/usr/bin/env node
'use strict';
// set-freeze.cjs — set or clear the directory boundary that check-freeze.cjs enforces.
//
// Usage: set-freeze.cjs <directory>   resolve it, require it to exist, save it
//        set-freeze.cjs --clear       remove the boundary
//
// The boundary is resolved here rather than in a shell one-liner because a
// failed `cd` in a one-liner leaves an empty value, which then became "/" once
// the trailing slash was appended. A boundary of "/" allows every absolute path
// while the user is told edits are restricted. A path that is not an existing
// directory is therefore an error, and the saved boundary stays as it was.

const fs = require('node:fs');
const path = require('node:path');

const { resolveProjectRoot } = require(path.join(__dirname, '../../../hooks/lib/project-root.cjs'));

const stateDir = process.env.CLAUDE_PLUGIN_DATA || path.join(resolveProjectRoot(), '.meowkit/state');
const boundaryFile = path.join(stateDir, 'freeze-dir.txt');

const fail = (message) => {
  process.stderr.write(`freeze: ${message}\n`);
  process.exit(1);
};

const arg = process.argv[2];
if (!arg) {
  process.stderr.write('usage: set-freeze.cjs <directory> | --clear\n');
  process.exit(2);
}

if (arg === '--clear') {
  fs.rmSync(boundaryFile, { force: true });
  process.stdout.write('Freeze boundary cleared: edits are no longer restricted.\n');
  process.exit(0);
}

let resolved;
try {
  resolved = fs.realpathSync(path.resolve(arg));
  if (!fs.statSync(resolved).isDirectory()) throw new Error('not a directory');
} catch {
  fail(`"${arg}" is not an existing directory; boundary not changed.`);
}

if (resolved === path.parse(resolved).root) {
  fail('refusing to freeze the filesystem root, which would allow every path; boundary not changed.');
}

const boundary = `${resolved.replace(/\/+$/, '')}/`;
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(boundaryFile, `${boundary}\n`);

// Read it back so the confirmation shows what the hook will actually enforce.
const saved = fs.readFileSync(boundaryFile, 'utf8').trim();
process.stdout.write(`Freeze boundary set: ${saved}\n`);
