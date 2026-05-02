/**
 * Body for `permission_request` (heuristic 5s tool-stall fallback).
 *
 * The 5s heuristic catches generic stalls — including slow Bash. Copy here
 * is intentionally honest about the ambiguity: the user may be looking at a
 * permission dialog, OR Claude may simply be running a long tool.
 */

import { COLORS } from "@/lib/colors";
import type { Agent } from "@/lib/agent-types";
import { PauseFooter } from "./pause-footer";

interface PausePermissionBodyProps {
	agent: Agent;
}

export function PausePermissionBody({ agent }: PausePermissionBodyProps) {
	const tool = agent.currentTool ?? "(unknown)";
	const args = agent.task ?? "";

	return (
		<>
			<div className="flex-1 overflow-y-auto p-4 text-[12px]" style={{ color: COLORS.textPrimary }}>
				<Row label="Tool" value={tool} />
				{args && <Row label="Args" value={args} mono />}
				<div className="mt-4 text-[11px]" style={{ color: COLORS.textDim, lineHeight: 1.5 }}>
					Heuristic detection (5s stall). This may also be a slow tool — not
					necessarily a permission prompt.
				</div>
			</div>
			<PauseFooter />
		</>
	);
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="mb-3">
			<div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>
				{label}
			</div>
			<div style={{ color: COLORS.holoBright, fontFamily: mono ? "'SF Mono', monospace" : undefined }}>
				{value}
			</div>
		</div>
	);
}
