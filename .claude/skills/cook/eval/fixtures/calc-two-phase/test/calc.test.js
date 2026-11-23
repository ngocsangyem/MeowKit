const test = require('node:test');
const assert = require('node:assert');
const { add, subtract } = require('../src/calc');

test('add', () => assert.strictEqual(add(2, 3), 5));
test('subtract', () => assert.strictEqual(subtract(5, 3), 2));
