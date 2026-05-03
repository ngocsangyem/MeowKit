/**
 * PlanListItem — stateless row inside the PlanSwitcher drawer.
 *
 * Layout: [status pill] [title + slug] [relative mtime]
 * Props: summary, isSelected, onClick
 */

import { COLORS } from "@/lib/colors";
import { MK_TOKENS } from "@/lib/tokens.generated";
import { PLAN_STATUS_BADGES } from "./plan-status-palette";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { PlanSummary, PlanStatus } from "@/hooks/use-available-plans";

const STATUS_COLORS: Record<PlanStatus, { bg: string; text: string; label: string }> = PLAN_STATUS_BADGES as Record<
	PlanStatus,
	{ bg: string; text: string; label: string }
>;

interface PlanListItemProps {
	summary: PlanSummary;
	isSelected: boolean;
	onClick: () => void;
}

export function PlanListItem({ summary, isSelected, onClick }: PlanListItemProps) {
	const pill = STATUS_COLORS[summary.status] ?? STATUS_COLORS.unknown;
	const relTime = formatRelativeTime(summary.mtimeMs);

	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left px-3 py-2 flex items-center gap-2 ${
				isSelected ? "" : "orchviz-row-hover"
			}`}
			style={{
				background: isSelected ? COLORS.holoBg10 : "transparent",
				borderLeft: isSelected
					? `2px solid ${COLORS.holoBase}`
					: "2px solid transparent",
				cursor: "pointer",
				fontFamily: MK_TOKENS.typography.family.mono,
				transition: "background 0.12s ease",
				borderTop: "none",
				borderRight: "none",
				borderBottom: "none",
			}}
		>
			{/* Status pill */}
			<span
				className="flex-shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
				style={{ background: pill.bg, color: pill.text, minWidth: 44, textAlign: "center" }}
			>
				{pill.label}
			</span>

			{/* Title + slug */}
			<div className="flex-1 min-w-0">
				<div
					className="text-[11px] truncate"
					style={{ color: isSelected ? COLORS.holoBright : COLORS.textPrimary }}
				>
					{summary.title}
				</div>
				<div className="text-[10px] truncate" style={{ color: COLORS.textMuted }}>
					{summary.slug}
				</div>
			</div>

			{/* Relative mtime */}
			<span
				className="flex-shrink-0 text-[10px]"
				style={{ color: COLORS.textDim }}
			>
				{relTime}
			</span>
		</button>
	);
}
