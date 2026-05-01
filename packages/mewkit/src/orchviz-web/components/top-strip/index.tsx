/**
 * TopStrip — fixed top strip showing canonical phase pipeline + gate state.
 *
 * Hosts the PlanSwitcher hamburger; forwards selectedSlug and the
 * liveViewSubtitle setter so drawer clicks can update the chip context.
 */

import { COLORS } from "@/lib/colors";
import type { UseActivePlanResult } from "@/hooks/use-active-plan";
import { useOverlays } from "@/hooks/use-overlays";
import { derivePhaseStatuses } from "@/lib/phase-status";
import { PhasePipeline } from "./phase-pipeline";
import { PlanSwitcher } from "@/components/plan-switcher";

interface TopStripProps {
	onGateClick?: (id: "G1" | "G2") => void;
	selectedSlug: string | null;
	onSelectSlug: (slug: string | null) => void;
	/** Lifted from AgentVisualizer so we don't double-poll. */
	activePlan: UseActivePlanResult;
	/** Setter for the LiveViewChip subtitle, threaded into the drawer. */
	onLiveViewSubtitle: (subtitle: string | null) => void;
}

export function TopStrip({
	onGateClick,
	selectedSlug,
	onSelectSlug,
	activePlan,
	onLiveViewSubtitle,
}: TopStripProps) {
	const { plan } = activePlan;
	const overlays = useOverlays();

	const gate1Approved = overlays.gate1?.approved === true;
	const gate2Verdict =
		(overlays.gate2?.verdict as "PASS" | "WARN" | "FAIL" | undefined) ?? null;

	const phaseStates = derivePhaseStatuses(plan, { gate1Approved, gate2Verdict });

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
			<PlanSwitcher
				selectedSlug={selectedSlug}
				onSelect={onSelectSlug}
				activePlan={activePlan}
				onLiveViewSubtitle={onLiveViewSubtitle}
			/>

			<div className="text-[10px] uppercase tracking-widest" style={{ color: COLORS.textMuted }}>
				MeowKit
			</div>
			<PhasePipeline
				phases={phaseStates}
				gate1Approved={gate1Approved}
				gate2Verdict={gate2Verdict}
				onGateClick={onGateClick}
			/>
		</div>
	);
}
