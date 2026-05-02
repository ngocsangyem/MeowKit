/**
 * PausePill — small amber pill shown in chrome when ≥1 agent is paused.
 *
 * Mounted in TopStrip (visible chrome) and exported for re-use by StatusBanner.
 * Click opens the PauseDetailDrawer in single-agent mode (count===1) or
 * list-view mode (count≥2).
 */

import { COLORS } from "@/lib/colors";
import { REASON_LABEL, type PauseSummary } from "@/lib/pause-labels";

interface PausePillProps {
	summary: PauseSummary;
	onClick: (summary: PauseSummary) => void;
}

export function PausePill({ summary, onClick }: PausePillProps) {
	if (summary.count === 0) return null;

	const text =
		summary.count === 1 && summary.first
			? `Paused: ${REASON_LABEL[summary.first.pauseReason ?? "permission_request"]} ${summary.first.name}`
			: `Paused: ${summary.count} agents`;

	return (
		<button
			type="button"
			onClick={() => onClick(summary)}
			// pointer-events-auto wins over a parent's pointer-events-none Tailwind utility
			// (red-team #11) — utility-on-utility specificity beats inline-style override.
			className="pointer-events-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono"
			style={{
				background: COLORS.pausedBg,
				border: `1px solid ${COLORS.pausedBorder}`,
				color: COLORS.paused,
				cursor: "pointer",
				whiteSpace: "nowrap",
			}}
			aria-label={text}
		>
			<span>⏸</span>
			<span>{text}</span>
		</button>
	);
}
