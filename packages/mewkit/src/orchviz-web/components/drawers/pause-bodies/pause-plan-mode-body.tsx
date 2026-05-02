/**
 * Body for `plan_mode_review` (ExitPlanMode tool_use pending).
 *
 * Renders the plan text inside a <pre>. The plan string is server-truncated
 * to PLAN_PREVIEW_MAX (2KB).
 *
 * [red-team #16 — XSS] The plan string is split on \n and rendered as JSX
 * children — React's automatic text-node escape is the security boundary.
 * NEVER use dangerouslySetInnerHTML or string concatenation of <br> tags.
 */

import { COLORS } from "@/lib/colors";
import type { Agent } from "@/lib/agent-types";
import { PauseFooter } from "./pause-footer";

interface PausePlanModeBodyProps {
	agent: Agent;
}

export function PausePlanModeBody({ agent }: PausePlanModeBodyProps) {
	const plan = agent.pauseDetail?.plan ?? "";

	return (
		<>
			<div className="flex-1 overflow-y-auto p-4 text-[12px]" style={{ color: COLORS.textPrimary }}>
				<div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: COLORS.textMuted }}>
					Plan
				</div>
				<pre
					style={{
						overflow: "auto",
						whiteSpace: "pre",
						background: COLORS.codeBlockBg,
						border: `1px solid ${COLORS.holoBorder08}`,
						borderRadius: 4,
						padding: "10px 12px",
						color: COLORS.holoBright,
						fontSize: 11,
						lineHeight: 1.5,
						maxHeight: 320,
					}}
				>
					{plan.split("\n").map((line, i) => (
						<div key={i}>{line || " "}</div>
					))}
				</pre>
			</div>
			<PauseFooter extra="Approve or reject the plan in your terminal" />
		</>
	);
}
