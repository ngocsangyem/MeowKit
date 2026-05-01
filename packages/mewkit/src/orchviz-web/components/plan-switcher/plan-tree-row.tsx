/**
 * PlanTreeRow — single plan row in the drawer + lazy-mounted children.
 *
 * Header row: [chevron] [status pill] [title + slug] [relative mtime]
 *  - chevron click → expand/collapse children only
 *  - title click   → onSelect(slug) → close drawer (Phase 3 wires this)
 *
 * When expanded:
 *  - if slug === selectedSlug, reuse the lifted `activePlan` prop (no extra poll)
 *  - else, mount a local useActivePlan(slug) which only runs while expanded
 *
 * Phase children are rendered through PhaseTreeRow and indented 16px.
 */

import { useState } from "react";
import { COLORS } from "@/lib/colors";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
	useActivePlan,
	type UseActivePlanResult,
} from "@/hooks/use-active-plan";
import type { PlanSummary, PlanStatus } from "@/hooks/use-available-plans";
import { PhaseTreeRow } from "./phase-tree-row";

const STATUS_PILL: Record<PlanStatus, { bg: string; text: string; label: string }> = {
	draft: { bg: "rgba(100,200,255,0.10)", text: "#66ccff", label: "draft" },
	in_progress: { bg: "rgba(255,187,68,0.12)", text: "#ffbb44", label: "in-prog" },
	active: { bg: "rgba(255,187,68,0.12)", text: "#ffbb44", label: "active" },
	completed: { bg: "rgba(102,255,170,0.10)", text: "#66ffaa", label: "done" },
	blocked: { bg: "rgba(255,85,102,0.10)", text: "#ff5566", label: "blocked" },
	archived: { bg: "rgba(100,200,255,0.04)", text: "#66ccff40", label: "archived" },
	unknown: { bg: "rgba(100,200,255,0.06)", text: "#66ccff60", label: "?" },
};

interface PlanTreeRowProps {
	summary: PlanSummary;
	isSelected: boolean;
	expanded: boolean;
	onToggleExpand: () => void;
	onSelectPlan: () => void;
	/** Lifted active plan, reused when summary.slug === selectedSlug. */
	activePlan: UseActivePlanResult;
	/** Phase 3: drawer→graph navigation (close drawer + set chip subtitle). */
	onPhaseClick?: (phase: { number: number; title: string }) => void;
}

export function PlanTreeRow({
	summary,
	isSelected,
	expanded,
	onToggleExpand,
	onSelectPlan,
	activePlan,
	onPhaseClick,
}: PlanTreeRowProps) {
	const pill = STATUS_PILL[summary.status] ?? STATUS_PILL.unknown;
	const relTime = formatRelativeTime(summary.mtimeMs);

	return (
		<div>
			<div
				className="flex items-center gap-2 px-3 py-2"
				style={{
					background: isSelected ? "rgba(100,200,255,0.10)" : "transparent",
					borderLeft: isSelected
						? `2px solid ${COLORS.holoBase}`
						: "2px solid transparent",
					fontFamily: "'SF Mono', 'Fira Code', monospace",
				}}
			>
				<button
					type="button"
					onClick={onToggleExpand}
					aria-label={expanded ? "Collapse plan" : "Expand plan"}
					aria-expanded={expanded}
					className="flex-shrink-0"
					style={{
						background: "transparent",
						border: "none",
						color: COLORS.textMuted,
						cursor: "pointer",
						width: 14,
						padding: 0,
						lineHeight: 1,
					}}
				>
					{expanded ? "▼" : "▶"}
				</button>

				<button
					type="button"
					onClick={onSelectPlan}
					className="flex-1 flex items-center gap-2 min-w-0 text-left"
					style={{
						background: "transparent",
						border: "none",
						padding: 0,
						cursor: "pointer",
					}}
				>
					<span
						className="flex-shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
						style={{
							background: pill.bg,
							color: pill.text,
							minWidth: 44,
							textAlign: "center",
						}}
					>
						{pill.label}
					</span>
					<div className="flex-1 min-w-0">
						<div
							className="text-[11px] truncate"
							style={{ color: isSelected ? COLORS.holoBright : COLORS.textPrimary }}
						>
							{summary.title}
						</div>
						<div className="text-[10px] truncate" style={{ color: COLORS.textMuted }}>
							{summary.slug}
						</div>
					</div>
					<span className="flex-shrink-0 text-[10px]" style={{ color: COLORS.textDim }}>
						{relTime}
					</span>
				</button>
			</div>

			{expanded && (
				<PlanTreeChildren
					summary={summary}
					isSelected={isSelected}
					activePlan={activePlan}
					onPhaseClick={onPhaseClick}
				/>
			)}
		</div>
	);
}

interface PlanTreeChildrenProps {
	summary: PlanSummary;
	isSelected: boolean;
	activePlan: UseActivePlanResult;
	onPhaseClick?: (phase: { number: number; title: string }) => void;
}

/**
 * Mounted only when its parent row is expanded. Decides whether to reuse the
 * lifted `activePlan` (when this is the selected plan) or fetch on its own.
 *
 * The conditional hook is safe here because the component itself (and its
 * hook tree) only mounts when expanded; `summary.slug` is stable for the
 * lifetime of the component.
 */
function PlanTreeChildren({
	summary,
	isSelected,
	activePlan,
	onPhaseClick,
}: PlanTreeChildrenProps) {
	if (isSelected) {
		return (
			<PlanTreeChildrenBody source={activePlan} onPhaseClick={onPhaseClick} />
		);
	}
	return <PlanTreeChildrenLazy slug={summary.slug} onPhaseClick={onPhaseClick} />;
}

function PlanTreeChildrenLazy({
	slug,
	onPhaseClick,
}: {
	slug: string;
	onPhaseClick?: (phase: { number: number; title: string }) => void;
}) {
	const result = useActivePlan(slug);
	return <PlanTreeChildrenBody source={result} onPhaseClick={onPhaseClick} />;
}

function PlanTreeChildrenBody({
	source,
	onPhaseClick,
}: {
	source: UseActivePlanResult;
	onPhaseClick?: (phase: { number: number; title: string }) => void;
}) {
	const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());

	const togglePhase = (n: number): void => {
		setExpandedPhases((prev) => {
			const next = new Set(prev);
			if (next.has(n)) next.delete(n);
			else next.add(n);
			return next;
		});
	};

	if (source.status === "loading") {
		return (
			<div
				className="text-[10px] italic"
				style={{
					paddingLeft: 32,
					paddingRight: 12,
					paddingTop: 4,
					paddingBottom: 4,
					color: COLORS.textMuted,
				}}
			>
				Loading…
			</div>
		);
	}
	if (source.status === "empty" || !source.plan) {
		return (
			<div
				className="text-[10px] italic"
				style={{
					paddingLeft: 32,
					paddingRight: 12,
					paddingTop: 4,
					paddingBottom: 4,
					color: COLORS.textMuted,
				}}
			>
				(plan empty)
			</div>
		);
	}

	const phases = source.plan.phases.filter((p) => !p.abandoned);
	if (phases.length === 0) {
		return (
			<div
				className="text-[10px] italic"
				style={{
					paddingLeft: 32,
					paddingRight: 12,
					paddingTop: 4,
					paddingBottom: 4,
					color: COLORS.textMuted,
				}}
			>
				(no phases)
			</div>
		);
	}

	return (
		<div>
			{phases.map((phase) => {
				const handlePhase = onPhaseClick
					? () => onPhaseClick({ number: phase.number, title: phase.title })
					: undefined;
				return (
					<PhaseTreeRow
						key={phase.number}
						phase={phase}
						expanded={expandedPhases.has(phase.number)}
						onToggle={() => togglePhase(phase.number)}
						onPhaseClick={handlePhase}
						onTodoClick={handlePhase}
					/>
				);
			})}
		</div>
	);
}
