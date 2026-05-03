/**
 * AgentToolCallsList — last 5 tool calls for the selected agent.
 *
 * Reads from a snapshot of simulation tool calls passed in by the parent.
 * Filtered by agent id; newest first.
 */

import { useMemo } from "react";
import { COLORS } from "@/lib/colors";
import { MK_TOKENS } from "@/lib/tokens.generated";
import type { ToolCallNode } from "@/lib/agent-types";

interface AgentToolCallsListProps {
	agentId: string;
	toolCalls: Map<string, ToolCallNode>;
}

const STATE_COLOR: Record<ToolCallNode["state"], string> = {
	running: COLORS.tool_calling,
	complete: COLORS.complete,
	error: COLORS.error,
};

export function AgentToolCallsList({ agentId, toolCalls }: AgentToolCallsListProps) {
	const items = useMemo(() => {
		const list: ToolCallNode[] = [];
		for (const tc of toolCalls.values()) {
			if (tc.agentId === agentId) list.push(tc);
		}
		list.sort((a, b) => b.startTime - a.startTime);
		return list.slice(0, 5);
	}, [agentId, toolCalls]);

	return (
		<section className="px-4 py-3 border-b" style={{ borderColor: COLORS.panelSeparator }}>
			<div
				className="text-[10px] uppercase tracking-widest mb-2"
				style={{ color: COLORS.textMuted, fontFamily: MK_TOKENS.typography.family.mono }}
			>
				Recent tool calls
			</div>
			{items.length === 0 ? (
				<div className="text-[11px]" style={{ color: COLORS.textDim }}>
					No tool calls yet.
				</div>
			) : (
				<ul className="space-y-1.5">
					{items.map((tc) => (
						<li
							key={tc.id}
							className="flex items-center gap-2 text-[11px]"
							style={{
								color: COLORS.textPrimary,
								fontFamily: MK_TOKENS.typography.family.mono,
							}}
						>
							<span
								className="inline-block flex-shrink-0"
								style={{
									width: 6,
									height: 6,
									borderRadius: "50%",
									background: STATE_COLOR[tc.state],
								}}
								aria-label={tc.state}
							/>
							<span className="truncate" style={{ flex: 1 }} title={tc.toolName}>
								{tc.toolName}
							</span>
							<span className="truncate" style={{ color: COLORS.textDim, maxWidth: 140 }} title={tc.args}>
								{tc.args}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
