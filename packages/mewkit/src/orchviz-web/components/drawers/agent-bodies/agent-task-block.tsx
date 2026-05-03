/**
 * AgentTaskBlock — task description with 3-line truncation + expand.
 */

import { useState } from "react";
import { COLORS } from "@/lib/colors";
import { MK_TOKENS } from "@/lib/tokens.generated";

interface AgentTaskBlockProps {
	task: string | undefined;
}

export function AgentTaskBlock({ task }: AgentTaskBlockProps) {
	const [expanded, setExpanded] = useState(false);
	const value = task && task.trim().length > 0 ? task : "(no task assigned)";
	const isLong = value.length > 180;

	return (
		<section className="px-4 py-3 border-b" style={{ borderColor: COLORS.panelSeparator }}>
			<div
				className="text-[10px] uppercase tracking-widest mb-1.5"
				style={{ color: COLORS.textMuted, fontFamily: MK_TOKENS.typography.family.mono }}
			>
				Task
			</div>
			<div
				className="text-[12px] whitespace-pre-wrap"
				style={{
					color: COLORS.textPrimary,
					lineHeight: 1.5,
					display: expanded ? "block" : "-webkit-box",
					WebkitLineClamp: expanded ? "unset" : (3 as unknown as string),
					WebkitBoxOrient: "vertical",
					overflow: "hidden",
				}}
			>
				{value}
			</div>
			{isLong && (
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="mt-1.5 text-[10px]"
					style={{
						background: "transparent",
						border: "none",
						color: COLORS.scrollBtnText,
						cursor: "pointer",
						padding: 0,
					}}
				>
					{expanded ? "Show less" : "Show more"}
				</button>
			)}
		</section>
	);
}
