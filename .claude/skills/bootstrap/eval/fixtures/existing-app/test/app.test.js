const test = require('node:test');
const assert = require('node:assert');
const { add } = require('../src/app');
test('add', () => assert.strictEqual(add(1, 2), 3));
