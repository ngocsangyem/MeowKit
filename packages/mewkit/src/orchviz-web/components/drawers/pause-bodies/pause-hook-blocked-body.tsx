/**
 * Body for `hook_blocked` (system stop_hook_summary preventedContinuation=true).
 *
 * Shows the hook command + reason. Same line-split rendering rule as plan body
 * (red-team #16) — never use dangerouslySetInnerHTML for either field.
 */

import { COLORS } from "@/lib/colors";
import type { Agent } from "@/lib/agent-types";
import { PauseFooter } from "./pause-footer";

interface PauseHookBlockedBodyProps {
	agent: Agent;
}

export function PauseHookBlockedBody({ agent }: PauseHookBlockedBodyProps) {
	const cmd = agent.pauseDetail?.hookCommand ?? "(unknown hook)";
	const reason = agent.pauseDetail?.hookReason ?? "";

	return (
		<>
			<div className="flex-1 overflow-y-auto p-4 text-[12px]" style={{ color: COLORS.textPrimary }}>
				<div className="mb-3">
					<div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>
						Hook
					</div>
					<div style={{ color: COLORS.holoBright, fontFamily: "'SF Mono', monospace", fontSize: 11, wordBreak: "break-all" }}>
						{cmd}
					</div>
				</div>
				{reason && (
					<div className="mb-3">
						<div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: COLORS.textMuted }}>
							Reason
						</div>
						<div
							style={{
								color: COLORS.textPrimary,
								background: COLORS.codeBlockBg,
								border: `1px solid ${COLORS.holoBorder08}`,
								borderRadius: 4,
								padding: "8px 10px",
								fontSize: 11,
								lineHeight: 1.5,
								whiteSpace: "pre-wrap",
							}}
						>
							{reason.split("\n").map((line, i) => (
								<div key={i}>{line || " "}</div>
							))}
						</div>
					</div>
				)}
			</div>
			<PauseFooter extra="Resolve the hook condition, then continue in your terminal" />
		</>
	);
}
