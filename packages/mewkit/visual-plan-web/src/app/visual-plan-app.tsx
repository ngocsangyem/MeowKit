/**
 * VisualPlanApp — the studio shell. Fetches the artifact, runs the deterministic
 * layout, and composes the toolbar + canvas (lanes + artboards) + coverage panel
 * + read-only inspector. Read-only in Phase 4a; editing + feedback are Phase 5.
 */

import { useEffect, useMemo, useState } from "react";
import type { VisualPlan } from "../domain/artifact-types.js";
import { fetchPlan } from "../api/client.js";
import { layoutCanvas } from "../canvas/lane-layout.js";
import { CanvasViewport } from "../canvas/canvas-viewport.js";
import { LaneLayer } from "../canvas/lane-layer.js";
import { ConnectorLayer } from "../canvas/connector-layer.js";
import { ArtboardLayer } from "../canvas/artboard-layer.js";
import { AnnotationLayer } from "../canvas/annotation-layer.js";
import { SketchOverlay } from "../canvas/sketch-overlay.js";
import { CoveragePanel } from "./coverage-panel.js";
import { FrameInspector } from "../inspector/frame-inspector.js";

export function VisualPlanApp() {
	const [plan, setPlan] = useState<VisualPlan | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [sketch, setSketch] = useState(false);

	useEffect(() => {
		fetchPlan()
			.then((r) => setPlan(r.plan))
			.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
	}, []);

	const layout = useMemo(() => (plan ? layoutCanvas(plan.canvas.lanes, plan.canvas.frames) : null), [plan]);
	const framesById = useMemo(() => new Map((plan?.canvas.frames ?? []).map((f) => [f.id, f])), [plan]);
	const placedById = useMemo(() => new Map((layout?.frames ?? []).map((p) => [p.id, p])), [layout]);
	const selectedFrame = selectedId ? framesById.get(selectedId) ?? null : null;

	if (error) return <div className="vp-error" role="alert">Could not load the visual plan: {error}</div>;
	if (!plan || !layout) return <div className="vp-loading">Loading visual plan…</div>;

	return (
		<div className={`vp-app${sketch ? " vp-sketch" : ""}`}>
			<header className="vp-toolbar">
				<span className="vp-toolbar-title">{plan.id}</span>
				<span className="vp-toolbar-meta">rev {plan.revision}</span>
				<button type="button" className="vp-mode-toggle" aria-pressed={sketch} onClick={() => setSketch((s) => !s)}>
					{sketch ? "Clean" : "Sketch"}
				</button>
				<span className="vp-toolbar-review" data-status={plan.review.status}>{plan.review.status}</span>
			</header>
			<div className="vp-body">
				<CanvasViewport worldWidth={layout.width} worldHeight={layout.height}>
					<LaneLayer lanes={layout.lanes} />
					<ConnectorLayer connectors={plan.canvas.connectors} placedById={placedById} width={layout.width} height={layout.height} />
					<ArtboardLayer placed={layout.frames} framesById={framesById} selectedId={selectedId} onSelect={setSelectedId} />
					{sketch ? <SketchOverlay frames={layout.frames} width={layout.width} height={layout.height} /> : null}
					<AnnotationLayer annotations={plan.canvas.annotations} placedById={placedById} />
				</CanvasViewport>
				<CoveragePanel plan={plan} />
				<FrameInspector plan={plan} frame={selectedFrame} />
			</div>
		</div>
	);
}
