/**
 * AgentDetailDrawer — non-modal right-side drawer surfacing live agent details.
 *
 * Shell pattern: reuses PauseDrawerPortal (createPortal + slide animation).
 * Opens on canvas agent click; one drawer at a time across the visualizer.
 *
 * Read-only contract: NO control affordances. Surfaces name, state, task,
 * resources, recent tool calls, recent messages. When the agent is paused,
 * the existing PauseSection is appended to surface pause-specific info.
 */

import { useEffect, useState } from "react";
import { COLORS } from "@/lib/colors";
import type { Agent, ToolCallNode } from "@/lib/agent-types";
import { AgentDrawerHeader } from "./agent-bodies/agent-drawer-header";
import { AgentTaskBlock } from "./agent-bodies/agent-task-block";
import { AgentResourceBlock } from "./agent-bodies/agent-resource-block";
import { AgentToolCallsList } from "./agent-bodies/agent-tool-calls-list";
import { AgentMessagesList } from "./agent-bodies/agent-messages-list";
import { PauseDrawerPortal } from "./pause-drawer-portal";

const PANEL_ID = "agent-detail-drawer";
const HEADER_ID = "agent-detail-drawer-heading";

interface AgentDetailDrawerProps {
	open: boolean;
	onClose: () => void;
	/** Currently selected agent. May be null (just-cleared selection) — drawer renders nothing. */
	agent: Agent | null;
	/** Snapshot of all tool calls keyed by id (filtered locally by agent id). */
	toolCalls: Map<string, ToolCallNode>;
}

export function AgentDetailDrawer({ open, onClose, agent, toolCalls }: AgentDetailDrawerProps) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!open) return;
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [open]);

	return (
		<PauseDrawerPortal open={open} onClose={onClose}>
			{open && agent && (
				<div
					className="flex flex-col h-full"
					id={PANEL_ID}
					role="dialog"
					aria-modal="false"
					aria-labelledby={HEADER_ID}
				>
					<AgentDrawerHeader headerId={HEADER_ID} agent={agent} onClose={onClose} />
					<div className="flex-1 overflow-y-auto" style={{ background: COLORS.panelBg }}>
						<AgentTaskBlock task={agent.task} />
						<AgentResourceBlock agent={agent} now={now} />
						<AgentToolCallsList agentId={agent.name} toolCalls={toolCalls} />
						<AgentMessagesList bubbles={agent.messageBubbles} />
					</div>
				</div>
			)}
		</PauseDrawerPortal>
	);
}
