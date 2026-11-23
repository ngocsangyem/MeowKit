const test = require('node:test');
const assert = require('node:assert');
const { add } = require('../src/calc');
test('add', () => assert.strictEqual(add(1, 2), 3));
