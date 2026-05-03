/**
 * PlanHeader — plan title block.
 *
 * v1.2: accepts readonly prop. When true, renders a small banner above the
 * plan title: "READ-ONLY (set MEOWKIT_ORCHVIZ_READONLY=0 to enable writes)".
 */

import { COLORS } from "@/lib/colors";
import { MK_TOKENS } from "@/lib/tokens.generated";
import type { PlanData } from "@/hooks/use-active-plan";

interface PlanHeaderProps {
	plan: PlanData;
	readonly: boolean;
}

export function PlanHeader({ plan, readonly }: PlanHeaderProps) {
	return (
		<div
			className="px-3 py-2 border-b"
			style={{
				borderColor: COLORS.panelSeparator,
				fontFamily: MK_TOKENS.typography.family.mono,
			}}
		>
			{readonly && (
				<div
					className="mb-1.5 px-2 py-0.5 text-[9px] rounded"
					style={{
						background: COLORS.pausedBg,
						border: `1px solid ${COLORS.pausedBorder}`,
						color: COLORS.paused,
					}}
				>
					READ-ONLY (set <code>MEOWKIT_ORCHVIZ_READONLY=0</code> to enable writes)
				</div>
			)}
			<div className="text-[10px] uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
				PLAN · {plan.slug}
			</div>
			<div className="mt-0.5 text-[13px]" style={{ color: COLORS.textPrimary }}>
				{plan.title}
			</div>
			<div className="mt-1 text-[10px] flex gap-3" style={{ color: COLORS.textDim }}>
				<span>effort: {plan.effort}</span>
				<span>status: {plan.status}</span>
				<span>created: {plan.created}</span>
				<span>{plan.phases.length} phases</span>
			</div>
		</div>
	);
}
