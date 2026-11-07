'use strict';
// tdd-flag-detector.cjs — turn the test-first sentinel on or off from the prompt.
//
// Mechanical on purpose. The flag is detected from the prompt text and written
// to a file, so whether strict mode is on never depends on the model noticing
// and remembering a flag across turns.
//
// The whole-word forms are matched deliberately: `--tdd-something` is a
// different flag and must not switch the mode on, while `--tdd=on` and friends
// must.

const fs = require('node:fs');
const path = require('node:path');

const { SENTINEL_REL } = require('../lib/tdd-detect.cjs');

const TURN_OFF = /--no-tdd|--tdd=off|--tdd off/;
const TURN_ON_WORD = /--tdd(\s|$)/;
const TURN_ON_ASSIGNED = /--tdd=(on|true|1)/;

module.exports = function tddFlagDetector(ctx) {
  if (ctx.event && ctx.event !== 'UserPromptSubmit') return null;

  const data = ctx.hookInput && ctx.hookInput.data ? ctx.hookInput.data : {};
  const prompt = String(data.prompt || data.user_prompt || '');
  if (!prompt) return null;

  const sentinel = path.join(ctx.root, SENTINEL_REL);

  if (TURN_OFF.test(prompt)) {
    try {
      if (!fs.existsSync(sentinel)) return null;
      fs.rmSync(sentinel, { force: true });
      return { stderr: '[tdd] sentinel cleared by --no-tdd / --tdd=off\n' };
    } catch {
      return null;
    }
  }

  const assigned = TURN_ON_ASSIGNED.test(prompt);
  if (!assigned && !TURN_ON_WORD.test(prompt)) return null;

  try {
    fs.mkdirSync(path.dirname(sentinel), { recursive: true });
    fs.writeFileSync(sentinel, 'on\n');
  } catch {
    return null;
  }
  return {
    stderr: assigned
      ? '[tdd] sentinel written by --tdd= flag (mechanical detection)\n'
      : '[tdd] sentinel written by --tdd flag (mechanical detection)\n',
  };
};
