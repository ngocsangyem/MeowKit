/**
 * 9-position canonical pipeline: 7 phase chips + G1 + G2 diamonds inline.
 *
 * Layout: Orient · Plan · ◆G1 · Test · Build · Review · ◆G2 · Ship · Reflect
 */

import { COLORS } from "@/lib/colors";
import type { CanonicalPhaseState } from "@/lib/phase-status";
import { PhaseChip } from "./phase-chip";
import { GateDiamond } from "./gate-diamond";

interface PhasePipelineProps {
	phases: CanonicalPhaseState[];
	gate1Approved: boolean;
	gate2Verdict: "PASS" | "WARN" | "FAIL" | null;
	onPhaseClick?: (id: CanonicalPhaseState["id"]) => void;
	onGateClick?: (id: "G1" | "G2") => void;
}

function Connector() {
	return (
		<span
			aria-hidden
			className="inline-block"
			style={{
				width: 12,
				height: 1,
				background: COLORS.glassBorder,
				flexShrink: 0,
			}}
		/>
	);
}

export function PhasePipeline(props: PhasePipelineProps) {
	const byId = new Map(props.phases.map((p) => [p.id, p]));
	const get = (id: CanonicalPhaseState["id"]): CanonicalPhaseState =>
		byId.get(id) ?? { id, label: id, status: "pending" };

	return (
		<div className="flex items-center gap-1.5 overflow-x-auto pb-1">
			<PhaseChip phase={get("orient")} onClick={props.onPhaseClick} />
			<Connector />
			<PhaseChip phase={get("plan")} onClick={props.onPhaseClick} />
			<Connector />
			<GateDiamond id="G1" verdict={null} approved={props.gate1Approved} onClick={props.onGateClick} />
			<Connector />
			<PhaseChip phase={get("test")} onClick={props.onPhaseClick} />
			<Connector />
			<PhaseChip phase={get("build")} onClick={props.onPhaseClick} />
			<Connector />
			<PhaseChip phase={get("review")} onClick={props.onPhaseClick} />
			<Connector />
			<GateDiamond id="G2" verdict={props.gate2Verdict} onClick={props.onGateClick} />
			<Connector />
			<PhaseChip phase={get("ship")} onClick={props.onPhaseClick} />
			<Connector />
			<PhaseChip phase={get("reflect")} onClick={props.onPhaseClick} />
		</div>
	);
}
