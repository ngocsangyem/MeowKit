/**
 * AgentDrawerHeader — top strip for the agent detail drawer.
 *
 * Layout: [state-color stripe] · agent name · runtime/role line · close × .
 * Stripe color is sourced from the runtime AgentState via getStateColor().
 */

import { COLORS, getStateColor } from "@/lib/colors";
import { MK_TOKENS } from "@/lib/tokens.generated";
import type { Agent } from "@/lib/agent-types";

interface AgentDrawerHeaderProps {
	headerId: string;
	agent: Agent;
	onClose: () => void;
}

export function AgentDrawerHeader({ headerId, agent, onClose }: AgentDrawerHeaderProps) {
	const stateColor = getStateColor(agent.state);
	const runtime = agent.runtime ?? "claude";
	const role = agent.isMain ? "orchestrator" : "subagent";

	return (
		<>
			<div style={{ height: 4, background: stateColor, flexShrink: 0 }} />
			<div
				className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
				style={{ borderColor: COLORS.panelSeparator }}
			>
				<div className="flex flex-col gap-0.5 min-w-0">
					<span
						id={headerId}
						className="text-[13px] truncate"
						style={{
							color: COLORS.textPrimary,
							fontFamily: MK_TOKENS.typography.family.ui,
						}}
					>
						{agent.name}
					</span>
					<span
						className="text-[10px] uppercase tracking-widest truncate"
						style={{
							color: COLORS.textMuted,
							fontFamily: MK_TOKENS.typography.family.mono,
						}}
					>
						{runtime} · {role} · {agent.state}
					</span>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="px-2 text-[16px] flex-shrink-0"
					style={{
						background: "transparent",
						border: "none",
						color: COLORS.scrollBtnText,
						cursor: "pointer",
					}}
					aria-label="Close drawer"
				>
					×
				</button>
			</div>
		</>
	);
}
