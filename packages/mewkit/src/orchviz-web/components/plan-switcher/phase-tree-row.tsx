/**
 * PhaseTreeRow — single phase row inside the drawer tree.
 *
 * Layout:  [chevron] [status icon] [n.] [title] [progress n/total]
 * Expanded body: <TodoTextRow> per todo, indented 32px.
 *
 * Read-only. No writer hook, no toggle handler, no readonly branch.
 */

import { COLORS } from "@/lib/colors";
import type { PlanPhase } from "@/hooks/use-active-plan";
import { phaseProgress } from "@/lib/phase-progress";
import { TodoTextRow } from "./todo-text-row";

const STATUS_ICONS: Record<PlanPhase["status"], string> = {
	completed: "✓",
	active: "●",
	in_progress: "●",
	pending: "○",
	failed: "×",
	abandoned: "⊘",
	unknown: "?",
};

const STATUS_COLORS: Record<PlanPhase["status"], string> = {
	completed: COLORS.complete,
	active: COLORS.holoBase,
	in_progress: COLORS.holoBase,
	pending: COLORS.textMuted,
	failed: COLORS.error,
	abandoned: COLORS.textMuted,
	unknown: COLORS.tool_calling,
};

interface PhaseTreeRowProps {
	phase: PlanPhase;
	expanded: boolean;
	onToggle: () => void;
	/** Optional: clicking phase row body triggers navigation (Phase 3). */
	onPhaseClick?: () => void;
	/** Optional: clicking a todo delegates to the same phase navigation. */
	onTodoClick?: () => void;
}

export function PhaseTreeRow({
	phase,
	expanded,
	onToggle,
	onPhaseClick,
	onTodoClick,
}: PhaseTreeRowProps) {
	const progress = phaseProgress(phase);
	const color = STATUS_COLORS[phase.status];
	const isAbandoned = phase.abandoned;

	return (
		<div style={{ opacity: isAbandoned ? 0.5 : 1 }}>
			<div
				className="flex items-center gap-2 text-[11px]"
				style={{
					paddingLeft: 16,
					paddingRight: 12,
					paddingTop: 4,
					paddingBottom: 4,
					textDecoration: isAbandoned ? "line-through" : "none",
				}}
			>
				<button
					type="button"
					onClick={onToggle}
					aria-label={expanded ? "Collapse phase" : "Expand phase"}
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
					onClick={onPhaseClick}
					disabled={!onPhaseClick}
					className="flex-1 flex items-center gap-2 text-left min-w-0"
					style={{
						background: "transparent",
						border: "none",
						padding: 0,
						color: COLORS.textPrimary,
						cursor: onPhaseClick ? "pointer" : "default",
						fontFamily: "'SF Mono', 'Fira Code', monospace",
					}}
				>
					<span style={{ color, width: 12 }}>{STATUS_ICONS[phase.status]}</span>
					<span style={{ color: COLORS.textMuted, width: 16 }}>{phase.number}.</span>
					<span className="flex-1 truncate">{phase.title}</span>
					<span
						className="text-[10px] flex-shrink-0"
						style={{ color: COLORS.textDim }}
					>
						{progress.done}/{progress.total}
					</span>
				</button>
			</div>
			{expanded && phase.todos.length > 0 && (
				<div>
					{phase.todos.map((todo, idx) => (
						<TodoTextRow key={idx} todo={todo} onClick={onTodoClick} />
					))}
				</div>
			)}
			{expanded && phase.todos.length === 0 && (
				<div
					className="text-[10px]"
					style={{
						paddingLeft: 32,
						paddingRight: 12,
						paddingTop: 2,
						paddingBottom: 4,
						color: COLORS.textMuted,
						fontStyle: "italic",
					}}
				>
					(no todos)
				</div>
			)}
		</div>
	);
}
