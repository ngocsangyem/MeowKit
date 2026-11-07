'use strict';
// control-probe.cjs — a known-good fire, used as a control signal.
//
// Without it, "this probe never fired" is ambiguous between "the host does not
// support that event" and "the logger is broken". This one rides a documented,
// definitely-real event, so comparing its fire count against a probe's count
// separates the two explanations.

const { logHookEvent } = require('../lib/hook-logger.cjs');

module.exports = function controlProbe(ctx) {
  logHookEvent({ root: ctx.root, hook: 'control-probe', event: 'fired', sessionId: ctx.session_id });
  return null;
};
