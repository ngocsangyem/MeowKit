'use client';

/**
 * OrchViz — SSE Bridge Hook
 *
 * Maintains EventSource connection, buffers incoming events,
 * and exposes a drainEvents() function for the animation loop.
 * RT2-5: dedup by seq. RT2-7: reference-swap drain pattern.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import type { OrchEvent } from './simulation/types';

const BACKOFF_INITIAL_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

export interface SSEBridge {
  connected: boolean;
  drainEvents: () => OrchEvent[];
}

export function useSSEBridge(url: string): SSEBridge {
  const [connected, setConnected] = useState(false);
  const pendingEvents = useRef<OrchEvent[]>([]);
  const lastSeqRef = useRef<number>(-1);
  const backoffRef = useRef<number>(BACKOFF_INITIAL_MS);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  const pushDeduped = useCallback((events: OrchEvent[]) => {
    for (const ev of events) {
      if (ev.seq <= lastSeqRef.current) continue; // RT2-5: skip already-seen
      lastSeqRef.current = ev.seq;
      pendingEvents.current.push(ev);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!mountedRef.current) return;

      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        backoffRef.current = BACKOFF_INITIAL_MS; // reset on success
      };

      // Server sends unnamed `data:` messages with { type, event/events } wrapper
      es.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          switch (msg.type) {
            case 'orch-event':
              if (msg.event) pushDeduped([msg.event]);
              break;
            case 'event-batch':
              if (Array.isArray(msg.events)) pushDeduped(msg.events);
              break;
            case 'state-snapshot':
              if (msg.state?.events) pushDeduped(msg.state.events);
              break;
          }
        } catch {
          // malformed — skip
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        es.close();
        esRef.current = null;

        // Exponential backoff reconnect
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, BACKOFF_MAX_MS);
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [url, pushDeduped]);

  // RT2-7: reference-swap — O(1), never blocks the SSE message handler
  const drainEvents = useCallback((): OrchEvent[] => {
    const drained = pendingEvents.current;
    pendingEvents.current = [];
    return drained;
  }, []);

  return { connected, drainEvents };
}
