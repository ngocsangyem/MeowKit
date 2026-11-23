const test = require('node:test');
const assert = require('node:assert');
const { issueResetToken, redeemResetToken } = require('../src/auth');

test('token redeems once', () => {
  const t = issueResetToken('u1');
  assert.strictEqual(redeemResetToken(t), 'u1');
  assert.strictEqual(redeemResetToken(t), null);
});
