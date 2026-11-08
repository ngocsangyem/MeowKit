'use strict';
// Make the process this is preloaded into unable to reach the network.
//
// A closed-port proxy is not enough: `fetch` on the Node versions this suite
// runs under ignores `HTTPS_PROXY`/`NODE_USE_ENV_PROXY`, so a harness that set
// only those asserted an offline guarantee it did not have — the one shape of
// comment that gets relied on. The refusal is installed in-process instead, and
// inherited by every Node child through `NODE_OPTIONS`: name resolution and
// socket connect both fail, whatever the client library.
//
// The error code is distinct from anything the CLI produces, so a subcommand
// that tried to reach a release shows up as its own string in the output rather
// than as a generic failure.
const net = require('node:net');
const dns = require('node:dns');

const refuse = (what) => Object.assign(new Error(`offline sandbox refused ${what}`), { code: 'EOFFLINE' });

net.Socket.prototype.connect = function connect(...args) {
  const cb = args.find((a) => typeof a === 'function');
  // A caller that passed a callback is not listening for `error` yet; swallowing
  // the first one keeps the refusal from becoming an unhandled exception.
  if (typeof cb === 'function') this.once('error', () => {});
  process.nextTick(() => this.destroy(refuse('a socket connection')));
  return this;
};

dns.lookup = (host, optsOrCb, maybeCb) => {
  const done = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
  process.nextTick(() => done(refuse(`a DNS lookup for ${host}`)));
};
dns.promises.lookup = async (host) => {
  throw refuse(`a DNS lookup for ${host}`);
};
