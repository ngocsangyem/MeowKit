/**
 * Coverage panel — the ledger sidebar. Shows the computed summary (R/P/O/U) and
 * every state's closure mode. Reads the same view the validator computes, so an
 * `unresolved > 0` here is exactly what blocks Gate 1.
 */

import { useMemo } from "react";
import type { VisualPlan } from "../domain/artifact-types.js";
import { computeCoverageView, type StateMode } from "./coverage-view.js";

const MODE_LABEL: Record<StateMode, string> = {
	resolved: "resolved",
	planned: "planned",
	omitted: "omitted",
	unresolved: "unresolved",
};

export function CoveragePanel({ plan }: { plan: VisualPlan }) {
	const view = useMemo(() => computeCoverageView(plan), [plan]);
	const s = view.summary;
	return (
		<aside className="vp-coverage-panel" aria-label="Coverage ledger">
			<h2 className="vp-panel-title">Coverage</h2>
			<div className="vp-coverage-summary" data-unresolved={s.unresolved}>
				<span className="vp-cov-chip" data-mode="resolved">{s.resolved} resolved</span>
				<span className="vp-cov-chip" data-mode="planned">{s.planned} planned</span>
				<span className="vp-cov-chip" data-mode="omitted">{s.omitted} omitted</span>
				<span className="vp-cov-chip" data-mode="unresolved">{s.unresolved} unresolved</span>
			</div>
			<ul className="vp-coverage-list">
				{view.rows.map((row) => (
					<li key={`${row.surfaceId}/${row.stateId}`} className="vp-coverage-row" data-mode={row.mode}>
						<span className="vp-cov-state">{row.stateLabel}</span>
						<span className="vp-cov-surface">{row.surfaceLabel}</span>
						<span className="vp-cov-mode">{MODE_LABEL[row.mode]}</span>
					</li>
				))}
			</ul>
		</aside>
	);
}
