/**
 * useEventSource — connect to /events SSE relay, buffer incoming AgentEvents.
 *
 * Replaces agent-flow's useVSCodeBridge. Returns a frame-stable list of
 * pending events that the simulation hook drains via onExternalEventsConsumed.
 *
 * Buffers incoming events in a ref + flushes on rAF to coalesce bursts; caps
 * total queue at MAX_PENDING to bound memory if the simulation stalls.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { AgentEvent, ConnectionStatus } from "@/lib/bridge-types";

export interface UseEventSourceResult {
	pendingEvents: AgentEvent[];
	consumeEvents: (count: number) => void;
	connectionStatus: ConnectionStatus;
}

const MAX_PENDING = 1000;

export function useEventSource(url: string = "/events"): UseEventSourceResult {
	const [pendingEvents, setPendingEvents] = useState<AgentEvent[]>([]);
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("disconnected");
	const incomingRef = useRef<AgentEvent[]>([]);
	const flushScheduledRef = useRef(false);

	useEffect(() => {
		const es = new EventSource(url);
		es.onopen = (): void => setConnectionStatus("connected");
		es.onerror = (): void => setConnectionStatus("disconnected");

		const flush = (): void => {
			flushScheduledRef.current = false;
			const incoming = incomingRef.current;
			if (incoming.length === 0) return;
			incomingRef.current = [];
			setPendingEvents((prev) => {
				const merged = prev.concat(incoming);
				return merged.length > MAX_PENDING ? merged.slice(merged.length - MAX_PENDING) : merged;
			});
		};

		es.onmessage = (msg: MessageEvent<string>): void => {
			try {
				incomingRef.current.push(JSON.parse(msg.data) as AgentEvent);
			} catch {
				return;
			}
			if (!flushScheduledRef.current) {
				flushScheduledRef.current = true;
				requestAnimationFrame(flush);
			}
		};
		return () => {
			es.close();
		};
	}, [url]);

	const consumeEvents = useCallback((count: number) => {
		setPendingEvents((prev) => prev.slice(count));
	}, []);

	return { pendingEvents, consumeEvents, connectionStatus };
}
