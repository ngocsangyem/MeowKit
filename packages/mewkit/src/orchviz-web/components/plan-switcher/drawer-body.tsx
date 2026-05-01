/**
 * DrawerBody — inner body of PlanSwitcher drawer.
 *
 * Mounted only while the drawer is open so useAvailablePlans polling only runs
 * while visible. Renders a hierarchical tree (plan → phase → todo).
 *
 * Single-expand semantics: only one plan may be expanded at a time. Expanding
 * a new plan auto-collapses any previously expanded plan, which caps concurrent
 * useActivePlan instances to two (the lifted singleton + the lazy expanded row,
 * and the lazy row is skipped when slug === selectedSlug).
 */

import { useState } from "react";
import { COLORS } from "@/lib/colors";
import { useAvailablePlans, type PlanStatus } from "@/hooks/use-available-plans";
import type { UseActivePlanResult } from "@/hooks/use-active-plan";
import { PlanTreeRow } from "./plan-tree-row";

const ACTIVE_STATUSES = new Set<PlanStatus>([
	"draft",
	"in_progress",
	"active",
	"blocked",
	"unknown",
]);

interface DrawerBodyProps {
	selectedSlug: string | null;
	onSelect: (slug: string) => void;
	onClose: () => void;
	/** Lifted active plan — reused inside the tree row matching selectedSlug. */
	activePlan: UseActivePlanResult;
	/** Setter for the LiveViewChip subtitle (Phase 3 navigation). */
	onLiveViewSubtitle: (subtitle: string | null) => void;
}

export function DrawerBody({
	selectedSlug,
	onSelect,
	onClose,
	activePlan,
	onLiveViewSubtitle,
}: DrawerBodyProps) {
	const { status, plans } = useAvailablePlans();
	const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

	const visible = plans.filter((p) => p.status !== "archived");
	const activeGroup = visible.filter((p) => ACTIVE_STATUSES.has(p.status));
	const recentGroup = visible.filter((p) => p.status === "completed");

	const handleSelectPlan = (slug: string, title: string): void => {
		onSelect(slug);
		onLiveViewSubtitle(title);
		onClose();
	};

	const handlePhaseClickFor = (slug: string, planTitle: string) => {
		return (phase: { number: number; title: string }): void => {
			if (slug !== selectedSlug) onSelect(slug);
			onLiveViewSubtitle(`${planTitle} · phase ${phase.number}: ${phase.title}`);
			onClose();
		};
	};

	const toggleExpand = (slug: string): void => {
		setExpandedSlug((prev) => (prev === slug ? null : slug));
	};

	const renderGroup = (label: string, items: typeof visible) => {
		if (items.length === 0) return null;
		return (
			<div key={label}>
				<div
					className="px-3 py-1 text-[9px] uppercase tracking-widest"
					style={{
						color: COLORS.textMuted,
						borderBottom: `1px solid ${COLORS.panelSeparator}`,
					}}
				>
					{label}
				</div>
				{items.map((summary) => (
					<PlanTreeRow
						key={summary.slug}
						summary={summary}
						isSelected={summary.slug === selectedSlug}
						expanded={expandedSlug === summary.slug}
						onToggleExpand={() => toggleExpand(summary.slug)}
						onSelectPlan={() => handleSelectPlan(summary.slug, summary.title)}
						activePlan={activePlan}
						onPhaseClick={handlePhaseClickFor(summary.slug, summary.title)}
					/>
				))}
			</div>
		);
	};

	return (
		<>
			{status === "loading" && (
				<div
					className="flex-1 flex items-center justify-center"
					style={{ color: COLORS.textMuted }}
				>
					<span className="text-[11px]">Loading plans…</span>
				</div>
			)}
			{status === "empty" && (
				<div
					className="flex-1 flex items-center justify-center"
					style={{ color: COLORS.textMuted }}
				>
					<span className="text-[11px]">No plans found</span>
				</div>
			)}
			{status === "loaded" && (
				<div className="flex-1 overflow-y-auto">
					{renderGroup("Active", activeGroup)}
					{renderGroup("Recent", recentGroup)}
					{activeGroup.length === 0 && recentGroup.length === 0 && (
						<div
							className="px-3 py-4 text-center text-[11px]"
							style={{ color: COLORS.textMuted }}
						>
							No plans found
						</div>
					)}
				</div>
			)}
		</>
	);
}
