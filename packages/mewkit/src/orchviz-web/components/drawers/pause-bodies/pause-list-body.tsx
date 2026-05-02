/**
 * Multi-pause list body — shown when ≥2 agents are paused.
 *
 * Each row is a paused agent with reason + elapsed time. Clicking a row
 * swaps the drawer body to that agent's detail view.
 *
 * Sort order: oldest pause first (most "stuck").
 */

import { COLORS } from "@/lib/colors";
import type { Agent } from "@/lib/agent-types";
import { REASON_LABEL } from "@/lib/pause-labels";
import { PauseFooter } from "./pause-footer";

interface PauseListBodyProps {
	agents: Agent[];
	now: number;
	onSelect: (name: string) => void;
}

export function PauseListBody({ agents, now, onSelect }: PauseListBodyProps) {
	const sorted = [...agents].sort(
		(a, b) => (a.pauseStartedAt ?? 0) - (b.pauseStartedAt ?? 0),
	);

	return (
		<>
			<div className="flex-1 overflow-y-auto p-4 text-[12px]">
				<div className="text-[10px] uppercase tracking-wider mb-3" style={{ color: COLORS.textMuted }}>
					Click an agent to view detail
				</div>
				<ul className="space-y-1">
					{sorted.map((agent) => {
						const reason = agent.pauseReason ?? "permission_request";
						const startedAt = agent.pauseStartedAt ?? now;
						const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
						return (
							<li key={agent.id}>
								<button
									type="button"
									onClick={() => onSelect(agent.name)}
									className="w-full flex items-center justify-between px-3 py-2 rounded text-left"
									style={{
										background: "transparent",
										border: `1px solid ${COLORS.holoBorder08}`,
										color: COLORS.holoBright,
										cursor: "pointer",
										transition: "background 0.12s ease",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.background = COLORS.toggleActive;
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.background = "transparent";
									}}
								>
									<span style={{ color: COLORS.holoBright }}>► {agent.name}</span>
									<span className="text-[11px]" style={{ color: COLORS.paused }}>
										{REASON_LABEL[reason]} · {elapsedSec}s
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</div>
			<PauseFooter />
		</>
	);
}
