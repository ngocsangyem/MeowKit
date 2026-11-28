const { test } = require('node:test');
const assert = require('node:assert/strict');
const { greet } = require('./greet');

// The suite takes far longer than one tool call may wait, as a real integration suite can.
test('greets after a long setup', async () => {
  await new Promise((resolve) => setTimeout(resolve, 20 * 60 * 1000));
  assert.equal(greet('Ada'), 'Hello, Ada');
});
