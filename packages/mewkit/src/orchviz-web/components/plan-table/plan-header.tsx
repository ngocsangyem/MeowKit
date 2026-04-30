import { COLORS } from "@/lib/colors";
import type { PlanData } from "@/hooks/use-active-plan";

export function PlanHeader({ plan }: { plan: PlanData }) {
	return (
		<div
			className="px-3 py-2 border-b"
			style={{
				borderColor: COLORS.panelSeparator,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
			}}
		>
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
