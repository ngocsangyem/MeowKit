/**
 * local-web shared constants.
 *
 * The loopback bind host is the single security anchor for every primitive in
 * this layer: the server binds it, and the Host/Origin guards build their
 * allowlists from it. Keeping one constant avoids drift between "what we bind"
 * and "what we allow".
 */

/** Loopback interface — the server binds here and guards allow only this + localhost. */
export const LOOPBACK_HOST = "127.0.0.1";

/** Grace period for in-flight connections to drain on server stop. */
export const CLOSE_GRACE_MS = 5_000;
