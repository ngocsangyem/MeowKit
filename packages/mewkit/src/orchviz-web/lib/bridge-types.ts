/**
 * Shared types matching the server-side AgentEvent shape.
 * Ported from patoles/agent-flow @ 59ccf4e (web/lib/bridge-types.ts).
 * License Apache-2.0 (see ../../../NOTICE).
 */

export interface AgentEvent {
	time: number;
	type: string;
	payload: Record<string, unknown>;
	sessionId?: string;
}

export interface SessionInfo {
	id: string;
	label: string;
	status: "active" | "completed";
	startTime: number;
	lastActivityTime: number;
}

export type ConnectionStatus = "connected" | "disconnected" | "watching";
