/**
 * OrchViz — Shared Logger
 *
 * Minimal structured logging with level control.
 */

const PREFIX = '[orchviz]';

export const log = {
  info: (...args: unknown[]) => console.log(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, '⚠', ...args),
  error: (...args: unknown[]) => console.error(PREFIX, '✗', ...args),
  debug: (...args: unknown[]) => {
    if (process.env.ORCHVIZ_DEBUG) console.debug(PREFIX, '…', ...args);
  },
};
