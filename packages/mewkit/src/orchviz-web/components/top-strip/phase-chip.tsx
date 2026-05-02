/**
 * Single phase chip in the TopStrip pipeline. Status icon + label.
 */

import { COLORS } from "@/lib/colors";
import type { CanonicalPhaseState } from "@/lib/phase-status";

interface PhaseChipProps {
	phase: CanonicalPhaseState;
	onClick?: (id: CanonicalPhaseState["id"]) => void;
	/** Phase-05: when true AND chip is active, switches to amber pulse keyframe. */
	paused?: boolean;
}

const ICONS = {
	completed: "✓",
	active: "●",
	pending: "░",
} as const;

const COLORS_FOR_STATUS = {
	completed: COLORS.complete,
	active: COLORS.holoBase,
	pending: COLORS.textMuted,
} as const;

export function PhaseChip({ phase, onClick, paused = false }: PhaseChipProps) {
	const isActive = phase.status === "active";
	const color = isActive && paused ? COLORS.paused : COLORS_FOR_STATUS[phase.status];
	const activeClass = isActive
		? paused
			? "phase-chip-active-paused"
			: "phase-chip-active"
		: `phase-chip-${phase.status}`;
	return (
		<button
			type="button"
			className={`phase-chip ${activeClass} inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono tracking-tight whitespace-nowrap`}
			style={{
				background: isActive ? COLORS.toggleActive : COLORS.toggleInactive,
				border: `1px solid ${color}55`,
				color,
				cursor: "pointer",
			}}
			onClick={() => onClick?.(phase.id)}
			aria-label={`Phase ${phase.label} — ${phase.status}${isActive && paused ? " (paused)" : ""}`}
		>
			<span className="text-[10px]" style={{ width: 10, textAlign: "center" }}>
				{ICONS[phase.status]}
			</span>
			<span>{phase.label}</span>
		</button>
	);
}
