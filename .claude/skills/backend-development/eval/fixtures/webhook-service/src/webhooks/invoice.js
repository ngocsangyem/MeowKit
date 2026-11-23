const accounts = { acct_1: 0 };

// Called by the payment provider for every `invoice.paid` event.
function onInvoicePaid(event) {
  accounts[event.accountId] += event.amountCents;
  return accounts[event.accountId];
}

module.exports = { onInvoicePaid, accounts };
