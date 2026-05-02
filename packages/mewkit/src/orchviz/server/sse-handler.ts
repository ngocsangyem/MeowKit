/**
 * SSE handler — replay buffer, heartbeat, Last-Event-ID, client cap.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type {
	AgentEvent,
	AgentEventType,
	PauseStartedPayload,
	PauseClearedPayload,
} from "../protocol.js";
import {
	MAX_SSE_BUFFER,
	MAX_SSE_CLIENTS,
	SSE_HEARTBEAT_MS,
	PAUSE_MIN_DURATION_MS,
} from "../constants.js";

const SPAWN_TYPE: AgentEventType = "agent_spawn";
const PAUSE_STARTED: AgentEventType = "pause_started";
const PAUSE_CLEARED: AgentEventType = "pause_cleared";

export interface BufferedEvent {
	id: number;
	event: AgentEvent;
}

interface PauseDebounceEntry {
	timer: NodeJS.Timeout;
	bufferedEvent: AgentEvent;
}

function pauseKey(event: AgentEvent): string {
	const payload = event.payload as unknown as Partial<PauseStartedPayload | PauseClearedPayload>;
	const session = event.sessionId ?? "_";
	const agent = payload?.agent ?? "_";
	const tid = payload?.toolUseId ?? "*";
	return `${session}:${agent}:${tid}`;
}

export class SseRelay {
	private readonly clients = new Set<ServerResponse>();
	private readonly buffer: BufferedEvent[] = [];
	// Persistent registry of agent_spawn events keyed by `${sessionId}:${name}`.
	// The ring buffer evicts old events, but a browser that reconnects mid-session
	// still needs to know which agents exist — otherwise tool_call_* events drop
	// silently because their target agent was never spawned in the client view.
	private readonly agentRegistry = new Map<string, BufferedEvent>();
	// [red-team #6] Parallel registry for pause_started so reconnecting clients
	// see active pauses even after the ring buffer has evicted the originating
	// event. Cleared on pause_cleared.
	private readonly pauseRegistry = new Map<string, BufferedEvent>();
	// [red-team #8] Pause debouncer with explicit cancellation handle.
	// Buffers `pause_started` for PAUSE_MIN_DURATION_MS so a `pause_cleared`
	// arriving inside the window cancels both events (no UI flicker).
	private readonly pauseDebounce = new Map<string, PauseDebounceEntry>();
	private nextId = 1;
	private heartbeat: NodeJS.Timeout | null = null;

	start(): void {
		if (this.heartbeat) return;
		this.heartbeat = setInterval(() => this.sendHeartbeat(), SSE_HEARTBEAT_MS);
		if (typeof this.heartbeat.unref === "function") this.heartbeat.unref();
	}

	stop(): void {
		if (this.heartbeat) clearInterval(this.heartbeat);
		this.heartbeat = null;
		for (const entry of this.pauseDebounce.values()) clearTimeout(entry.timer);
		this.pauseDebounce.clear();
		for (const c of this.clients) {
			try {
				c.end();
			} catch {
				// ignore
			}
		}
		this.clients.clear();
	}

	clientCount(): number {
		return this.clients.size;
	}

	publish(event: AgentEvent): void {
		// Pause debouncer: buffer pause_started for PAUSE_MIN_DURATION_MS.
		// If pause_cleared arrives in the window, drop both. Otherwise emit on timer fire.
		if (event.type === PAUSE_STARTED) {
			const key = pauseKey(event);
			// Cancel a prior buffered pause_started for the same key — a duplicate
			// shouldn't double-emit; latest wins.
			const prior = this.pauseDebounce.get(key);
			if (prior) clearTimeout(prior.timer);
			const timer = setTimeout(() => {
				this.pauseDebounce.delete(key);
				this.publishImmediately(event);
			}, PAUSE_MIN_DURATION_MS);
			if (typeof timer.unref === "function") timer.unref();
			this.pauseDebounce.set(key, { timer, bufferedEvent: event });
			return;
		}
		if (event.type === PAUSE_CLEARED) {
			const key = pauseKey(event);
			const pending = this.pauseDebounce.get(key);
			if (pending) {
				clearTimeout(pending.timer);
				this.pauseDebounce.delete(key);
				return; // sub-window pause cancelled — drop both events
			}
			// No exact-key match — fallback search by `${session}:${agent}:*` so a
			// pause_cleared for permission_request (no toolUseId) still cancels
			// any pending heuristic pause for the same agent.
			const sessionAgentPrefix = key.replace(/:[^:]*$/, ":");
			for (const [k, entry] of this.pauseDebounce) {
				if (k.startsWith(sessionAgentPrefix)) {
					clearTimeout(entry.timer);
					this.pauseDebounce.delete(k);
					return;
				}
			}
			// Otherwise fall through and publish pause_cleared normally.
		}
		this.publishImmediately(event);
	}

	private publishImmediately(event: AgentEvent): void {
		const id = this.nextId++;
		const buffered: BufferedEvent = { id, event };
		this.buffer.push(buffered);
		if (this.buffer.length > MAX_SSE_BUFFER) this.buffer.shift();
		if (event.type === SPAWN_TYPE) {
			const name = (event.payload?.name as string | undefined) ?? "unknown";
			this.agentRegistry.set(`${event.sessionId ?? "_"}:${name}`, buffered);
		}
		if (event.type === PAUSE_STARTED || event.type === PAUSE_CLEARED) {
			// [code-review fix] Align pauseRegistry key to pauseKey() so multiple
			// pauses on the same (session, agent) but different toolUseIds don't
			// collide. Two-part key would silently overwrite the older entry on
			// a second concurrent pause, dropping it from reconnect replay.
			const key = pauseKey(event);
			if (event.type === PAUSE_STARTED) {
				this.pauseRegistry.set(key, buffered);
			} else {
				this.pauseRegistry.delete(key);
				// Also clear any wildcard-toolUseId variant so a heuristic
				// permission_request clear that omits toolUseId removes the entry
				// previously written by the same heuristic pause_started.
				const prefix = key.replace(/:[^:]*$/, ":");
				for (const k of this.pauseRegistry.keys()) {
					if (k.startsWith(prefix)) this.pauseRegistry.delete(k);
				}
			}
		}
		this.broadcast(id, event);
	}

	handle(req: IncomingMessage, res: ServerResponse): void {
		if (this.clients.size >= MAX_SSE_CLIENTS) {
			res.writeHead(503, { "Content-Type": "text/plain" });
			res.end("Too many SSE clients");
			return;
		}
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		});
		res.write(": connected\n\n");

		const lastIdHeader = req.headers["last-event-id"];
		const lastId = typeof lastIdHeader === "string" ? parseInt(lastIdHeader, 10) || 0 : 0;
		// Replay agent_spawn registry first so the client knows which agents exist
		// before any tool_call_* / message events arrive that reference them. Skip
		// any agent_spawn already inside the ring buffer (avoid duplicate).
		const bufferedIds = new Set(this.buffer.map((b) => b.id));
		for (const buffered of this.agentRegistry.values()) {
			if (buffered.id > lastId && !bufferedIds.has(buffered.id)) {
				this.writeOne(res, buffered.id, buffered.event);
			}
		}
		// [red-team #6] Replay pause_started events whose pauses are still active.
		for (const buffered of this.pauseRegistry.values()) {
			if (buffered.id > lastId && !bufferedIds.has(buffered.id)) {
				this.writeOne(res, buffered.id, buffered.event);
			}
		}
		for (const buffered of this.buffer) {
			if (buffered.id > lastId) this.writeOne(res, buffered.id, buffered.event);
		}

		this.clients.add(res);
		const cleanup = (): void => {
			this.clients.delete(res);
		};
		req.on("close", cleanup);
		req.on("error", cleanup);
		res.on("error", cleanup);
	}

	private broadcast(id: number, event: AgentEvent): void {
		for (const res of this.clients) {
			try {
				const ok = this.writeOne(res, id, event);
				if (!ok) {
					// Slow client; backpressure → drop further events for it but keep alive.
					continue;
				}
			} catch {
				this.clients.delete(res);
				try {
					res.end();
				} catch {
					// ignore
				}
			}
		}
	}

	private writeOne(res: ServerResponse, id: number, event: AgentEvent): boolean {
		return res.write(`id: ${id}\ndata: ${JSON.stringify(event)}\n\n`);
	}

	private sendHeartbeat(): void {
		for (const res of this.clients) {
			try {
				res.write(": ping\n\n");
			} catch {
				this.clients.delete(res);
				try {
					res.end();
				} catch {
					// ignore
				}
			}
		}
	}
}
