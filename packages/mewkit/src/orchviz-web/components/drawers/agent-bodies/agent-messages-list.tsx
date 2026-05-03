/**
 * AgentMessagesList — last 5 message bubbles for the selected agent.
 * Newest first; bubble role drives the color band.
 */

import { COLORS, ROLE_COLORS } from "@/lib/colors";
import { MK_TOKENS } from "@/lib/tokens.generated";
import type { MessageBubble } from "@/lib/agent-types";

interface AgentMessagesListProps {
	bubbles: MessageBubble[];
}

export function AgentMessagesList({ bubbles }: AgentMessagesListProps) {
	const items = bubbles.slice(-5).reverse();

	return (
		<section className="px-4 py-3" style={{ borderColor: COLORS.panelSeparator }}>
			<div
				className="text-[10px] uppercase tracking-widest mb-2"
				style={{ color: COLORS.textMuted, fontFamily: MK_TOKENS.typography.family.mono }}
			>
				Recent messages
			</div>
			{items.length === 0 ? (
				<div className="text-[11px]" style={{ color: COLORS.textDim }}>
					No messages yet.
				</div>
			) : (
				<ul className="space-y-2">
					{items.map((bubble, i) => {
						const role = ROLE_COLORS[bubble.role] ?? ROLE_COLORS.assistant;
						return (
							<li
								key={i}
								className="text-[11px] px-2 py-1.5"
								style={{
									background: role.bg,
									color: role.text,
									borderRadius: MK_TOKENS.radius.md,
									lineHeight: 1.5,
								}}
							>
								<div
									className="text-[9px] uppercase tracking-widest mb-0.5"
									style={{
										color: COLORS.textMuted,
										fontFamily: MK_TOKENS.typography.family.mono,
									}}
								>
									{role.label}
								</div>
								<div
									className="whitespace-pre-wrap"
									style={{
										display: "-webkit-box",
										WebkitLineClamp: 4 as unknown as string,
										WebkitBoxOrient: "vertical",
										overflow: "hidden",
									}}
								>
									{bubble.text}
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
