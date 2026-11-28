const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sum } = require('./sum');

test('sums a list', () => {
  assert.equal(sum([1, 2, 3]), 6);
});
