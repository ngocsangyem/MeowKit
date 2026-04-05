/**
 * OrchViz — Hook Receiver
 *
 * HTTP POST handler for Claude Code hook events.
 * Responds with 200 immediately, then enriches + broadcasts async.
 */

import type * as http from 'node:http';
import type { HookPayload, OrchEvent } from '../../src/protocol.js';
import { enrich, type EnricherState } from '../../src/orch-enricher.js';
import * as eventStore from '../../src/event-store.js';
import { HOOK_MAX_BODY_SIZE } from '../../src/constants.js';
import { log } from '../../src/logger.js';

// C3: Track which sessions have received hook events (hooks active = skip JSONL tailing)
export const hookActiveSessions = new Set<string>();

export interface HookReceiverOptions {
  enricherState: EnricherState;
  broadcast: (event: OrchEvent) => void;
}

/**
 * Handle an incoming hook POST request.
 * Returns 200 immediately — enrichment happens after response.
 */
export function handleHookPost(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: HookReceiverOptions,
): void {
  let body = '';
  let oversized = false;

  req.on('data', (chunk: Buffer) => {
    if (oversized) return;
    body += chunk.toString();
    if (body.length > HOOK_MAX_BODY_SIZE) {
      oversized = true;
      body = '';
      log.warn('Hook payload exceeded size limit, discarding');
    }
  });

  req.on('end', () => {
    // Always return 200 — hooks must never block Claude Code
    res.writeHead(200);
    res.end();

    if (oversized) return;

    // Async enrichment after response sent
    try {
      const payload = JSON.parse(body) as HookPayload;
      if (!payload || !payload.session_id || !payload.hook_event_name) {
        log.warn('Invalid hook payload: missing session_id or hook_event_name');
        return;
      }

      // C3: Mark this session as hook-active (SessionWatcher will skip it)
      hookActiveSessions.add(payload.session_id);

      const event = enrich(payload, options.enricherState);
      eventStore.append(event.sessionId, event);
      options.broadcast(event);

      log.debug(`Hook: ${payload.hook_event_name} → session ${payload.session_id.slice(0, 8)}`);
    } catch (err) {
      log.warn('Failed to process hook:', (err as Error).message);
    }
  });
}
