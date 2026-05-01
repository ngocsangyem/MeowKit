/**
 * PlanTable — left primary panel. Read-only structured plan view with
 * collapsible phase rows. Auto-expands the active phase on first mount; honors
 * orchviz:scroll-to-phase events from TopStrip.
 *
 * v1.2: accepts selectedSlug prop; passes to useActivePlan.
 *       When slug changes, resets initializedRef so auto-expand fires for the new plan.
 *       Phase 4: wires useTodoWriter; renders optimisticPhases; passes per-phase
 *       etag slice + write props to each PhaseRow. (R2-5)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { UseActivePlanResult } from "@/hooks/use-active-plan";
import { useTodoWriter } from "@/hooks/use-todo-writer";
import { COLORS } from "@/lib/colors";
import { PlanHeader } from "./plan-header";
import { PhaseRow } from "./phase-row";
import { EmptyState, LoadingState } from "./empty-state";

interface PlanTableProps {
	selectedSlug?: string | null;
	/** Lifted from AgentVisualizer so we don't double-poll (perf fix). */
	activePlan: UseActivePlanResult;
}

export function PlanTable({ selectedSlug, activePlan }: PlanTableProps) {
	const { status, plan, phaseEtags, readonly, refetch } = activePlan;
	const [expanded, setExpanded] = useState<Set<number>>(new Set());
	const initializedRef = useRef(false);
	const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

	// Resolve slug — prefer selectedSlug, fall back to plan.slug (most-recent default)
	const slug = selectedSlug ?? plan?.slug ?? "";

	// Reset auto-expand when slug changes so the new plan's active phase expands
	const prevSlugRef = useRef<string | null | undefined>(selectedSlug);
	if (prevSlugRef.current !== selectedSlug) {
		prevSlugRef.current = selectedSlug;
		initializedRef.current = false;
	}

	const visiblePhases = useMemo(() => {
		if (!plan) return [];
		return plan.phases.filter((p) => !p.abandoned);
	}, [plan]);

	// Wire optimistic writer (R2-5: pass full phaseEtags map)
	const { optimisticPhases, toggle } = useTodoWriter(
		slug,
		visiblePhases,
		phaseEtags,
		refetch,
		readonly,
	);

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

	const toggleExpanded = (num: number): void => {
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
			<PlanHeader plan={plan} readonly={readonly} />
			<div className="flex-1 overflow-y-auto">
				{optimisticPhases.map((phase) => (
					<div
						key={phase.number}
						ref={(el) => {
							if (el) rowRefs.current.set(phase.number, el);
						}}
					>
						<PhaseRow
							phase={phase}
							expanded={expanded.has(phase.number)}
							onToggle={() => toggleExpanded(phase.number)}
							slug={slug}
							etag={phaseEtags?.[phase.number] ?? ""}
							readonly={readonly}
							onTodoToggle={toggle}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
