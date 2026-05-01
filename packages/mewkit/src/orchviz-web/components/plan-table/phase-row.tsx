/**
 * Single phase row. Status icon (incl. "?" for unknown — red-team H1) + progress
 * bar + source phase-file path label (red-team M5).
 *
 * v1.2: threads slug, etag, readonly, onTodoToggle to TodoList.
 */

import { COLORS } from "@/lib/colors";
import type { PlanPhase } from "@/hooks/use-active-plan";
import { phaseProgress } from "@/lib/phase-progress";
import { TodoList } from "./todo-list";
import type { TodoToggleArgs } from "@/hooks/use-todo-writer";

interface PhaseRowProps {
	phase: PlanPhase;
	expanded: boolean;
	onToggle: () => void;
	/** v1.2 write props */
	slug: string;
	etag: string;
	readonly: boolean;
	onTodoToggle: (args: TodoToggleArgs) => void;
}

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

const STATUS_TOOLTIPS: Partial<Record<PlanPhase["status"], string>> = {
	unknown: "Could not detect phase status — check phase file frontmatter or `**Status:**` block",
};

function shortPath(filePath: string): string {
	const idx = filePath.indexOf("/tasks/plans/");
	return idx >= 0 ? filePath.slice(idx + 1) : filePath;
}

export function PhaseRow({
	phase,
	expanded,
	onToggle,
	slug,
	etag,
	readonly,
	onTodoToggle,
}: PhaseRowProps) {
	const progress = phaseProgress(phase);
	const isActive = phase.status === "active" || phase.status === "in_progress";
	const color = STATUS_COLORS[phase.status];
	const isAbandoned = phase.abandoned;

	return (
		<div
			className="border-b"
			style={{
				borderColor: COLORS.panelSeparator,
				opacity: isAbandoned ? 0.5 : 1,
			}}
		>
			<button
				type="button"
				onClick={onToggle}
				className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-[rgba(100,200,255,0.04)] ${isActive ? "phase-chip-active" : ""}`}
				style={{
					background: "transparent",
					border: "none",
					cursor: "pointer",
					fontFamily: "'SF Mono', 'Fira Code', monospace",
					textDecoration: isAbandoned ? "line-through" : "none",
				}}
				aria-expanded={expanded}
			>
				<span style={{ color: COLORS.textMuted, width: 10 }}>{expanded ? "▼" : "▶"}</span>
				<span title={STATUS_TOOLTIPS[phase.status]} style={{ color, width: 14 }}>
					{STATUS_ICONS[phase.status]}
				</span>
				<span style={{ color: COLORS.textMuted, width: 16 }}>{phase.number}.</span>
				<span className="flex-1 truncate" style={{ color: COLORS.textPrimary }}>
					{phase.title}
				</span>
				<span style={{ color: COLORS.textDim, width: 50, textAlign: "right" }}>{phase.effort}</span>
				<span
					className="ml-2 inline-block"
					style={{
						width: 80,
						height: 6,
						background: COLORS.toggleInactive,
						border: `1px solid ${COLORS.toggleBorder}`,
						borderRadius: 2,
						overflow: "hidden",
					}}
				>
					<span
						className="block h-full"
						style={{ width: `${progress.percent}%`, background: color }}
					/>
				</span>
				<span className="ml-1 text-[10px]" style={{ color: COLORS.textDim, width: 36, textAlign: "right" }}>
					{progress.done}/{progress.total}
				</span>
			</button>
			<div
				className="px-7 pb-1 text-[9px] font-mono"
				style={{ color: COLORS.textMuted, opacity: 0.6 }}
			>
				{shortPath(phase.filePath)}
			</div>
			{expanded && (
				<TodoList
					todos={phase.todos}
					phaseNumber={phase.number}
					readonly={readonly}
					onToggle={onTodoToggle}
				/>
			)}
		</div>
	);
}
