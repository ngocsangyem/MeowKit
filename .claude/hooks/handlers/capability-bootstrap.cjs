'use strict';
// capability-bootstrap.cjs — emit the capability-resolution guidance at session start.
//
// The text is a committed, human-approved constant generated from the CLI. This
// handler only reads it: no CLI spawn and no runtime dependency, so a session
// never waits on a subprocess to learn how to resolve a capability. A drift test
// keeps the file in sync with its source.
//
// The file is located relative to THIS handler rather than a fixed path, because
// the same tree is also published in a layout rooted differently. Silent when
// absent, so a partial install never turns session start into an error.

const fs = require('node:fs');
const path = require('node:path');

const BOOTSTRAP_FILE = path.join(__dirname, '../../capability-bootstrap.md');

module.exports = function capabilityBootstrap() {
  try {
    return `${fs.readFileSync(BOOTSTRAP_FILE, 'utf8')}\n`;
  } catch {
    return null;
  }
};
