/**
 * VisualPlanApp — the studio shell. Loads the artifact through the editable-plan
 * hook (serialized save queue), runs the deterministic layout, and composes the
 * toolbar (+ save status, sketch toggle) + canvas + coverage panel + inspector
 * (with bounded edit controls) + feedback draft panel.
 */

import { useMemo, useState } from "react";
import { layoutCanvas } from "../canvas/lane-layout.js";
import { CanvasViewport } from "../canvas/canvas-viewport.js";
import { LaneLayer } from "../canvas/lane-layer.js";
import { ConnectorLayer } from "../canvas/connector-layer.js";
import { ArtboardLayer } from "../canvas/artboard-layer.js";
import { AnnotationLayer } from "../canvas/annotation-layer.js";
import { WobbleFilterDefs } from "../canvas/wobble-filter.js";
import { CoveragePanel } from "./coverage-panel.js";
import { FeedbackDraftPanel } from "./feedback-draft.js";
import { FrameInspector } from "../inspector/frame-inspector.js";
import { EditControls } from "../inspector/edit-controls.js";
import { useEditablePlan } from "./use-editable-plan.js";

const SAVE_LABEL: Record<string, string> = { clean: "saved", dirty: "editing…", saving: "saving…", stale: "stale — reload", error: "save failed" };

export function VisualPlanApp() {
	const { plan, error, saveState, edit } = useEditablePlan();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	// Sketchy (hand-drawn) is the DEFAULT register, matching agent-native; the
	// toggle switches to the crisp clean mode.
	const [sketch, setSketch] = useState(true);

	const layout = useMemo(() => (plan ? layoutCanvas(plan.canvas.lanes, plan.canvas.frames) : null), [plan]);
	const framesById = useMemo(() => new Map((plan?.canvas.frames ?? []).map((f) => [f.id, f])), [plan]);
	const placedById = useMemo(() => new Map((layout?.frames ?? []).map((p) => [p.id, p])), [layout]);
	const selectedFrame = selectedId ? framesById.get(selectedId) ?? null : null;

	// Full-screen only on the INITIAL load failure; a mid-session reload error
	// becomes a non-blocking banner so a loaded plan is never discarded.
	if (!plan || !layout) {
		if (error) return <div className="vp-error" role="alert">Could not load the visual plan: {error}</div>;
		return <div className="vp-loading">Loading visual plan…</div>;
	}

	return (
		<div className={`vp-app${sketch ? " vp-sketch" : ""}`} data-style={sketch ? "sketchy" : "clean"}>
			{sketch ? <WobbleFilterDefs /> : null}
			<header className="vp-toolbar">
				<span className="vp-toolbar-title">{plan.id}</span>
				<span className="vp-toolbar-meta">rev {plan.revision}</span>
				<span className="vp-save-status" data-state={saveState}>{SAVE_LABEL[saveState] ?? saveState}</span>
				<button type="button" className="vp-mode-toggle" aria-pressed={sketch} onClick={() => setSketch((s) => !s)}>
					{sketch ? "Clean" : "Sketch"}
				</button>
				<span className="vp-toolbar-review" data-status={plan.review.status}>{plan.review.status}</span>
				{error ? <span className="vp-error-banner" role="alert">{error}</span> : null}
			</header>
			<div className="vp-body">
				<CanvasViewport worldWidth={layout.width} worldHeight={layout.height}>
					<LaneLayer lanes={layout.lanes} />
					<ConnectorLayer connectors={plan.canvas.connectors} placedById={placedById} width={layout.width} height={layout.height} />
					<ArtboardLayer placed={layout.frames} framesById={framesById} selectedId={selectedId} sketch={sketch} onSelect={setSelectedId} />
					<AnnotationLayer annotations={plan.canvas.annotations} placedById={placedById} />
				</CanvasViewport>
				<CoveragePanel plan={plan} />
				<div className="vp-side">
					<FrameInspector plan={plan} frame={selectedFrame} />
					{selectedFrame ? <EditControls frame={selectedFrame} lanes={plan.canvas.lanes} onEdit={edit} /> : null}
					<FeedbackDraftPanel canPrepare={saveState === "clean"} />
				</div>
			</div>
		</div>
	);
}
