/**
 * PlanHeader — plan title block.
 *
 * v1.2: accepts readonly prop. When true, renders a small banner above the
 * plan title: "READ-ONLY (set MEOWKIT_ORCHVIZ_READONLY=0 to enable writes)".
 */

import { COLORS } from "@/lib/colors";
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
				fontFamily: "'SF Mono', 'Fira Code', monospace",
			}}
		>
			{readonly && (
				<div
					className="mb-1.5 px-2 py-0.5 text-[9px] rounded"
					style={{
						background: "rgba(255, 180, 50, 0.1)",
						border: "1px solid rgba(255, 180, 50, 0.3)",
						color: "rgba(255, 180, 50, 0.9)",
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
