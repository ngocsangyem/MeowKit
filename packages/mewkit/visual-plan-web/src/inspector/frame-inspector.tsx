/**
 * Read-only frame inspector (Phase 4a). Shows the selected frame's metadata —
 * surface, change mode, covered states, and source-ref evidence. Editing arrives
 * in Phase 5; this phase only reads.
 */

import type { VisualPlan, Frame } from "../domain/artifact-types.js";

interface Props {
	plan: VisualPlan;
	frame: Frame | null;
}

export function FrameInspector({ plan, frame }: Props) {
	if (!frame) {
		return (
			<aside className="vp-inspector" aria-label="Frame inspector">
				<p className="vp-inspector-empty">Select a frame to inspect it.</p>
			</aside>
		);
	}
	const refs = plan.sourceRefs.filter((r) => frame.sourceRefIds.includes(r.id));
	return (
		<aside className="vp-inspector" aria-label="Frame inspector">
			<h2 className="vp-panel-title">{frame.label}</h2>
			<dl className="vp-inspector-fields">
				<dt>Surface</dt><dd>{frame.surface}</dd>
				<dt>Change</dt><dd>{frame.changeMode}</dd>
				<dt>States</dt><dd>{frame.coverageStateIds.join(", ") || "—"}</dd>
				<dt>Evidence</dt>
				<dd>
					{refs.length === 0 ? "planned (no code ref)" : (
						<ul className="vp-inspector-refs">
							{refs.map((r) => <li key={r.id} data-kind={r.kind}>{r.ref}</li>)}
						</ul>
					)}
				</dd>
			</dl>
		</aside>
	);
}
