/**
 * Pause-reason → human label map.
 *
 * Single source of truth shared by the PauseDetailDrawer (phase-04) and
 * the StatusBanner pause pill / LiveControlBar swap (phase-05).
 *
 * Labels deliberately short — they appear inline next to agent names
 * inside narrow chrome (≤24 chars budget for "⏸ Paused: <label> <agent>").
 */

import type { PauseReason } from "../../orchviz/protocol";
import type { Agent } from "./agent-types";

/** Aggregated pause state used by global indicators (banner pill, top-strip, bottom-bar). */
export interface PauseSummary {
	count: number;
	first: Agent | null;
	agents: readonly Agent[];
}

export function selectPauseSummary(agents: Map<string, Agent>): PauseSummary {
	const list = Array.from(agents.values()).filter((a) => a.state === "paused");
	return { count: list.length, first: list[0] ?? null, agents: list };
}

export const REASON_LABEL: Record<PauseReason, string> = {
	permission_request: "permission",
	ask_user_question: "question",
	plan_mode_review: "plan review",
	tool_rejected: "rejected",
	hook_blocked: "hook",
};

/** Drawer header — slightly more descriptive form. */
export const REASON_HEADER: Record<PauseReason, string> = {
	permission_request: "Permission required",
	ask_user_question: "Question",
	plan_mode_review: "Plan review",
	tool_rejected: "Tool rejected",
	hook_blocked: "Hook blocked",
};
