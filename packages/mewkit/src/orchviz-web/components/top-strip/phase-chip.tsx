/**
 * Single phase chip in the TopStrip pipeline. Status icon + label.
 */

import { COLORS } from "@/lib/colors";
import type { CanonicalPhaseState } from "@/lib/phase-status";

interface PhaseChipProps {
	phase: CanonicalPhaseState;
	onClick?: (id: CanonicalPhaseState["id"]) => void;
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

export function PhaseChip({ phase, onClick }: PhaseChipProps) {
	const color = COLORS_FOR_STATUS[phase.status];
	const isActive = phase.status === "active";
	return (
		<button
			type="button"
			className={`phase-chip phase-chip-${phase.status} inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono tracking-tight whitespace-nowrap`}
			style={{
				background: isActive ? COLORS.toggleActive : COLORS.toggleInactive,
				border: `1px solid ${color}55`,
				color,
				cursor: "pointer",
			}}
			onClick={() => onClick?.(phase.id)}
			aria-label={`Phase ${phase.label} — ${phase.status}`}
		>
			<span className="text-[10px]" style={{ width: 10, textAlign: "center" }}>
				{ICONS[phase.status]}
			</span>
			<span>{phase.label}</span>
		</button>
	);
}
