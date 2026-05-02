/**
 * Body for `tool_rejected` (user rejected a tool, Claude is waiting).
 *
 * Conveys terminal stall: Claude has stopped and is awaiting redirection.
 * Cleared when the same agent emits its next assistant text (parser side)
 * OR after a 60s safety timeout.
 */

import { COLORS } from "@/lib/colors";
import type { Agent } from "@/lib/agent-types";
import { PauseFooter } from "./pause-footer";

interface PauseRejectedBodyProps {
	agent: Agent;
}

export function PauseRejectedBody({ agent }: PauseRejectedBodyProps) {
	const tool = agent.currentTool ?? "(unknown)";
	const args = agent.task ?? "";

	return (
		<>
			<div className="flex-1 overflow-y-auto p-4 text-[12px]" style={{ color: COLORS.textPrimary }}>
				<div className="mb-3">
					<div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>
						You rejected
					</div>
					<div style={{ color: COLORS.holoBright }}>{tool}</div>
				</div>
				{args && (
					<div className="mb-4">
						<div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>
							Args
						</div>
						<div style={{ color: COLORS.textPrimary, fontFamily: "'SF Mono', monospace", fontSize: 11 }}>
							{args}
						</div>
					</div>
				)}
				<div className="mt-4 text-[11px]" style={{ color: COLORS.textDim, lineHeight: 1.5 }}>
					Claude has stopped and is waiting for new instructions.
				</div>
			</div>
			<PauseFooter extra="Reply in your terminal" />
		</>
	);
}
