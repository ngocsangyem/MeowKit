/**
 * PlanTable — left primary panel. Read-only structured plan view with
 * collapsible phase rows. Auto-expands the active phase on first mount; honors
 * orchviz:scroll-to-phase events from TopStrip.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useActivePlan } from "@/hooks/use-active-plan";
import { COLORS } from "@/lib/colors";
import { PlanHeader } from "./plan-header";
import { PhaseRow } from "./phase-row";
import { EmptyState, LoadingState } from "./empty-state";

export function PlanTable() {
	const { status, plan } = useActivePlan();
	const [expanded, setExpanded] = useState<Set<number>>(new Set());
	const initializedRef = useRef(false);
	const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

	const visiblePhases = useMemo(() => {
		if (!plan) return [];
		return plan.phases.filter((p) => !p.abandoned);
	}, [plan]);

	// Auto-expand active phase on first mount only (red-team H4 caveat: not on subsequent polls).
	useEffect(() => {
		if (initializedRef.current || visiblePhases.length === 0) return;
		const active = visiblePhases.find(
			(p) => p.status === "active" || p.status === "in_progress",
		);
		if (active) {
			setExpanded(new Set([active.number]));
		}
		initializedRef.current = true;
	}, [visiblePhases]);

	const toggle = (num: number): void => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(num)) next.delete(num);
			else next.add(num);
			return next;
		});
	};

	useEffect(() => {
		const handler = (ev: Event): void => {
			const detail = (ev as CustomEvent).detail;
			if (!detail) return;
			const target = visiblePhases.find(
				(p) => p.status === "active" || p.status === "in_progress",
			);
			if (target) {
				setExpanded((prev) => new Set(prev).add(target.number));
				rowRefs.current.get(target.number)?.scrollIntoView({ behavior: "smooth", block: "center" });
			}
		};
		document.addEventListener("orchviz:scroll-to-phase", handler);
		return () => document.removeEventListener("orchviz:scroll-to-phase", handler);
	}, [visiblePhases]);

	if (status === "loading") {
		return (
			<div className="h-full overflow-y-auto" style={{ background: COLORS.panelBg }}>
				<LoadingState />
			</div>
		);
	}
	if (status === "empty" || !plan) {
		return (
			<div className="h-full" style={{ background: COLORS.panelBg }}>
				<EmptyState />
			</div>
		);
	}
	return (
		<div className="h-full flex flex-col" style={{ background: COLORS.panelBg }}>
			<PlanHeader plan={plan} />
			<div className="flex-1 overflow-y-auto">
				{visiblePhases.map((phase) => (
					<div
						key={phase.number}
						ref={(el) => {
							if (el) rowRefs.current.set(phase.number, el);
						}}
					>
						<PhaseRow
							phase={phase}
							expanded={expanded.has(phase.number)}
							onToggle={() => toggle(phase.number)}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
