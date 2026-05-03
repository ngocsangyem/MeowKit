/**
 * Shared status palette for plan list rows and the plan tree.
 *
 * Each entry is sourced from token `signal.*` colors (via COLORS) plus
 * Orchviz extensions for `in_progress`/`active` (amber, awaiting design owner
 * decision on how to map "in-progress" outside the {queued,thinking,running,
 * done,failed} signal taxonomy).
 */

import { COLORS } from "@/lib/colors";

export interface StatusBadge {
	bg: string;
	text: string;
	label: string;
}

export const PLAN_STATUS_BADGES: Record<string, StatusBadge> = {
	draft: { bg: COLORS.holoBg10, text: COLORS.holoBase, label: "draft" },
	in_progress: { bg: COLORS.pausedBg, text: COLORS.tool_calling, label: "in-prog" },
	active: { bg: COLORS.pausedBg, text: COLORS.tool_calling, label: "active" },
	completed: { bg: COLORS.diffAddedBg, text: COLORS.complete, label: "done" },
	blocked: { bg: COLORS.diffRemovedBg, text: COLORS.error, label: "blocked" },
	archived: { bg: COLORS.holoBg03, text: COLORS.textMuted, label: "archived" },
	unknown: { bg: COLORS.holoBg05, text: COLORS.textDim, label: "?" },
};
