const test = require('node:test');
const assert = require('node:assert');
const { onInvoicePaid } = require('../src/webhooks/invoice');
test('credits', () => assert.strictEqual(onInvoicePaid({ accountId: 'acct_1', amountCents: 500 }), 500));
