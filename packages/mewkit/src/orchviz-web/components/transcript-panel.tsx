/**
 * Slim live transcript panel — auto-scrolling list of messages from simulation.
 * v1.1: lives inside a grid cell, fills h-full w-full (was floating overlay).
 */

import type { ConversationMessage } from "@/hooks/simulation/types";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { COLORS, ROLE_COLORS } from "@/lib/colors";

interface TranscriptPanelProps {
	conversation: ConversationMessage[];
	visible: boolean;
	onClose: () => void;
}

const ROLE_KEY: Record<ConversationMessage["type"], keyof typeof ROLE_COLORS> = {
	thinking: "thinking",
	tool_call: "assistant",
	tool_result: "assistant",
	user: "user",
	assistant: "assistant",
};

export function TranscriptPanel({ conversation, visible, onClose }: TranscriptPanelProps) {
	const { ref, handleScroll } = useAutoScroll(conversation.length, visible);

	if (!visible) return null;

	return (
		<div
			className="h-full w-full flex flex-col"
			style={{
				background: COLORS.panelBg,
				borderTop: `1px solid ${COLORS.glassBorder}`,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
			}}
		>
			<div
				className="flex items-center justify-between px-3 py-1 text-xs"
				style={{ borderBottom: `1px solid ${COLORS.panelSeparator}`, color: COLORS.panelLabel }}
			>
				<span>TRANSCRIPT · {conversation.length}</span>
				<button
					type="button"
					onClick={onClose}
					className="px-2 hover:opacity-100 opacity-60"
					style={{ color: COLORS.scrollBtnText, background: "transparent", border: "none", cursor: "pointer" }}
				>
					×
				</button>
			</div>
			<div ref={ref} onScroll={handleScroll} className="flex-1 overflow-y-auto p-2 space-y-1">
				{conversation.map((msg, idx) => {
					const role = ROLE_COLORS[ROLE_KEY[msg.type]];
					return (
						<div
							key={`${msg.timestamp}-${idx}`}
							className="rounded px-2 py-1 text-[10px] leading-snug"
							style={{
								background: role.bg,
								color: role.text,
								borderLeft: `2px solid ${role.text}66`,
							}}
						>
							<div className="text-[8px] uppercase tracking-wider mb-0.5" style={{ color: role.label }}>
								{role.label} · {msg.type}
							</div>
							<div className="whitespace-pre-wrap break-words">{msg.content}</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
