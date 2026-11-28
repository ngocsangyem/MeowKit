const { test } = require('node:test');
const assert = require('node:assert/strict');

// Kept by the team as a record of the old report format; it fails on purpose until the
// report module is rebuilt.
test('old report format', () => {
  assert.equal(require('../src/sum').sum([]), 'empty');
});
