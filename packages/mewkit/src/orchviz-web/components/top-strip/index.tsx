/**
 * TopStrip — fixed top strip showing canonical phase pipeline + gate state.
 *
 * v1.1 omits entry lane (red-team SCOPE_Q1).
 * v1.2 adds PlanSwitcher (hamburger) in left slot.
 *      Internal useActivePlan updated to useActivePlan(selectedSlug) (red-team H1)
 *      so the phase pipeline tracks the user-selected plan, not the most-recent.
 */

import { COLORS } from "@/lib/colors";
import type { UseActivePlanResult } from "@/hooks/use-active-plan";
import { useOverlays } from "@/hooks/use-overlays";
import { derivePhaseStatuses, type CanonicalPhaseId } from "@/lib/phase-status";
import { PhasePipeline } from "./phase-pipeline";
import { PlanSwitcher } from "@/components/plan-switcher";

interface TopStripProps {
	onGateClick?: (id: "G1" | "G2") => void;
	selectedSlug: string | null;
	onSelectSlug: (slug: string | null) => void;
	/** Lifted from AgentVisualizer so we don't double-poll (R1 H1 + perf fix). */
	activePlan: UseActivePlanResult;
}

export function TopStrip({ onGateClick, selectedSlug, onSelectSlug, activePlan }: TopStripProps) {
	const { plan } = activePlan;
	const overlays = useOverlays();

	const gate1Approved = overlays.gate1?.approved === true;
	const gate2Verdict =
		(overlays.gate2?.verdict as "PASS" | "WARN" | "FAIL" | undefined) ?? null;

	const phaseStates = derivePhaseStatuses(plan, { gate1Approved, gate2Verdict });

	const handlePhaseClick = (id: CanonicalPhaseId): void => {
		document.dispatchEvent(new CustomEvent("orchviz:scroll-to-phase", { detail: { id } }));
	};

	return (
		<div
			className="flex items-center gap-3 px-3 py-2 border-b"
			style={{
				background: COLORS.panelBg,
				borderColor: COLORS.panelSeparator,
				maxHeight: 80,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
			}}
		>
			{/* Left slot: hamburger PlanSwitcher */}
			<PlanSwitcher selectedSlug={selectedSlug} onSelect={onSelectSlug} />

			<div className="text-[10px] uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
				MeowKit
			</div>
			<PhasePipeline
				phases={phaseStates}
				gate1Approved={gate1Approved}
				gate2Verdict={gate2Verdict}
				onPhaseClick={handlePhaseClick}
				onGateClick={onGateClick}
			/>
		</div>
	);
}
