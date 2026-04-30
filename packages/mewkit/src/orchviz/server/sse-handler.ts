/**
 * SSE handler — replay buffer, heartbeat, Last-Event-ID, client cap.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AgentEvent, AgentEventType } from "../protocol.js";
import {
	MAX_SSE_BUFFER,
	MAX_SSE_CLIENTS,
	SSE_HEARTBEAT_MS,
} from "../constants.js";

const SPAWN_TYPE: AgentEventType = "agent_spawn";

export interface BufferedEvent {
	id: number;
	event: AgentEvent;
}

export class SseRelay {
	private readonly clients = new Set<ServerResponse>();
	private readonly buffer: BufferedEvent[] = [];
	// Persistent registry of agent_spawn events keyed by `${sessionId}:${name}`.
	// The ring buffer evicts old events, but a browser that reconnects mid-session
	// still needs to know which agents exist — otherwise tool_call_* events drop
	// silently because their target agent was never spawned in the client view.
	private readonly agentRegistry = new Map<string, BufferedEvent>();
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
		const id = this.nextId++;
		const buffered: BufferedEvent = { id, event };
		this.buffer.push(buffered);
		if (this.buffer.length > MAX_SSE_BUFFER) this.buffer.shift();
		if (event.type === SPAWN_TYPE) {
			const name = (event.payload?.name as string | undefined) ?? "unknown";
			this.agentRegistry.set(`${event.sessionId ?? "_"}:${name}`, buffered);
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
