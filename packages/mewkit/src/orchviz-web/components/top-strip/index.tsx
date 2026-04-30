/**
 * TopStrip — fixed top strip showing canonical phase pipeline + gate state.
 *
 * v1.1 omits entry lane (red-team SCOPE_Q1).
 */

import { COLORS } from "@/lib/colors";
import { useActivePlan } from "@/hooks/use-active-plan";
import { useOverlays } from "@/hooks/use-overlays";
import { derivePhaseStatuses, type CanonicalPhaseId } from "@/lib/phase-status";
import { PhasePipeline } from "./phase-pipeline";

interface TopStripProps {
	onGateClick?: (id: "G1" | "G2") => void;
}

export function TopStrip({ onGateClick }: TopStripProps) {
	const { plan } = useActivePlan();
	const overlays = useOverlays();

	const gate1Approved = overlays.gate1?.approved === true;
	const gate2Verdict =
		(overlays.gate2?.verdict as "PASS" | "WARN" | "FAIL" | undefined) ?? null;

	const phaseStates = derivePhaseStatuses(plan, { gate1Approved, gate2Verdict });

	const handlePhaseClick = (id: CanonicalPhaseId): void => {
		// Phase 4 PlanTable listens for this event to scroll the matching row into view.
		// Project-phase mapping is best-effort: clicking "Build" scrolls to the first
		// in_progress project-phase, otherwise the most recent completed one.
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
