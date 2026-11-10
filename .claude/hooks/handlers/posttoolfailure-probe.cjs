'use strict';
// posttoolfailure-probe.cjs — records that the tool-failure event fires at all.
//
// Telemetry only; it never blocks. It exists to establish whether the host
// delivers this event, which the control probe's fire count is compared against.
// Replace it with a structured failure logger once that is confirmed.

const { logHookEvent } = require('../lib/hook-logger.cjs');

module.exports = function posttoolfailureProbe(ctx) {
  logHookEvent({ root: ctx.root, hook: 'posttoolfailure-probe', event: 'fired', sessionId: ctx.session_id });
  return null;
};
