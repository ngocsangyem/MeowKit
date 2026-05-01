/**
 * DrawerBody — inner body of PlanSwitcher drawer.
 *
 * Mounted only when the drawer is open so useAvailablePlans polling only runs
 * while the drawer is visible (R2-8/M8).
 *
 * Renders loading skeleton, empty state, or grouped plan list (Active / Recent).
 */

import { useEffect, useRef } from "react";
import { COLORS } from "@/lib/colors";
import { useAvailablePlans, type PlanStatus } from "@/hooks/use-available-plans";
import { PlanListItem } from "./plan-list-item";

// Plans in these statuses surface in the "Active" group (R1 H3 + R2-5)
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
}

export function DrawerBody({ selectedSlug, onSelect, onClose }: DrawerBodyProps) {
	const { status, plans } = useAvailablePlans();
	const firstItemRef = useRef<HTMLButtonElement | null>(null);

	// Focus first list item on mount (simple focus management)
	useEffect(() => {
		const timer = setTimeout(() => firstItemRef.current?.focus(), 60);
		return () => clearTimeout(timer);
	}, []);

	// Filter archived; group remaining
	const visible = plans.filter((p) => p.status !== "archived");
	const activeGroup = visible.filter((p) => ACTIVE_STATUSES.has(p.status));
	const recentGroup = visible.filter((p) => p.status === "completed");

	const handleSelect = (slug: string): void => {
		onSelect(slug);
		onClose();
	};

	const renderGroup = (label: string, items: typeof visible, groupIdx: number) => {
		if (items.length === 0) return null;
		return (
			<div key={label}>
				<div
					className="px-3 py-1 text-[9px] uppercase tracking-widest"
					style={{ color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.panelSeparator}` }}
				>
					{label}
				</div>
				{items.map((summary, itemIdx) => {
					const isFirst = groupIdx === 0 && itemIdx === 0;
					return (
						<div
							key={summary.slug}
							ref={isFirst ? (el) => { firstItemRef.current = el?.querySelector("button") ?? null; } : undefined}
						>
							<PlanListItem
								summary={summary}
								isSelected={summary.slug === selectedSlug}
								onClick={() => handleSelect(summary.slug)}
							/>
						</div>
					);
				})}
			</div>
		);
	};

	return (
		<>
			{status === "loading" && (
				<div className="flex-1 flex items-center justify-center" style={{ color: COLORS.textMuted }}>
					<span className="text-[11px]">Loading plans…</span>
				</div>
			)}
			{status === "empty" && (
				<div className="flex-1 flex items-center justify-center" style={{ color: COLORS.textMuted }}>
					<span className="text-[11px]">No plans found</span>
				</div>
			)}
			{status === "loaded" && (
				<div className="flex-1 overflow-y-auto">
					{renderGroup("Active", activeGroup, 0)}
					{renderGroup("Recent", recentGroup, activeGroup.length === 0 ? 0 : 1)}
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
