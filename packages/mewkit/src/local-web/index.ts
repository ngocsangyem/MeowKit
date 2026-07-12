/**
 * local-web — domain-neutral loopback web primitives.
 *
 * Extracted (Phase 2) from the prior local-server implementation so the Visual
 * Plan studio (and any future loopback tool) reuses ONE audited copy of the security- and
 * concurrency-sensitive code: loopback server lifecycle, Host/Origin guards,
 * bounded body reading, realpath containment, atomic writes, SHA-256 ETags,
 * traversal-guarded static serving, and cross-platform browser open.
 *
 * Dependency direction is product-domain → local-web only; this layer imports
 * nothing product-specific.
 */

export { LOOPBACK_HOST, CLOSE_GRACE_MS } from "./constants.js";
export { isHostAllowed } from "./host-guard.js";
export { isOriginAllowed } from "./origin-guard.js";
export { bufferBody, BodyError } from "./request-body.js";
export { safeRealpath, isContainedPath, resolveContained } from "./path-boundary.js";
export { atomicWriteFileSync, cleanOrphanedTmps } from "./atomic-write.js";
export { computeEtag, etagFromFile, isStaleEtag } from "./etag.js";
export { serveStatic } from "./static-handler.js";
export { openBrowser } from "./open-browser.js";
export { LocalServer, type LocalServerOptions, type RequestHandler } from "./local-server.js";
