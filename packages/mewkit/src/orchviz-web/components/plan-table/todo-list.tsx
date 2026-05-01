/**
 * Todo checklist — branched on readonly.
 *
 * readonly:true  → v1.1 disabled-checkbox + tooltip (unchanged UX).
 * readonly:false → interactive <input type="checkbox"> with onChange handler.
 *
 * Keyboard: native checkbox handles Space/Enter — no preventDefault.
 * Click target: min 24×24px via padding on the wrapper.
 * Per red-team M3: tooltip title on wrapper div (not the disabled input)
 * for Firefox-compatible tooltips.
 */

import { COLORS } from "@/lib/colors";
import type { PlanTodo } from "@/hooks/use-active-plan";
import type { TodoToggleArgs } from "@/hooks/use-todo-writer";

const HINT_READONLY = "server is read-only — edit the phase file to mark complete";

interface TodoListProps {
	todos: PlanTodo[];
	phaseNumber: number;
	readonly: boolean;
	onToggle: (args: TodoToggleArgs) => void;
}

export function TodoList({ todos, phaseNumber, readonly, onToggle }: TodoListProps) {
	if (todos.length === 0) {
		return (
			<div className="px-2 py-1 text-[10px]" style={{ color: COLORS.textDim }}>
				(no todos)
			</div>
		);
	}

	return (
		<div className="px-2 py-1 space-y-0.5">
			{todos.map((todo, idx) =>
				readonly ? (
					// ── v1.1 read-only path (unchanged) ──────────────────────────
					<div
						key={todo.text}
						title={HINT_READONLY}
						className="flex items-start gap-1.5 text-[11px] cursor-not-allowed"
						style={{
							color: todo.checked ? COLORS.complete : COLORS.textDim,
							opacity: todo.checked ? 0.7 : 1,
						}}
					>
						<input
							type="checkbox"
							checked={todo.checked}
							readOnly
							disabled
							className="mt-0.5 cursor-not-allowed"
							style={{ accentColor: COLORS.holoBase }}
						/>
						<span
							className="flex-1"
							style={{
								textDecoration: todo.checked ? "line-through" : "none",
								wordBreak: "break-word",
							}}
						>
							{todo.text}
						</span>
					</div>
				) : (
					// ── v1.2 interactive path ─────────────────────────────────────
					<div
						key={todo.text}
						className="flex items-start gap-1.5 text-[11px] min-h-6"
						style={{
							color: todo.checked ? COLORS.complete : COLORS.textDim,
							opacity: todo.checked ? 0.8 : 1,
						}}
					>
						<input
							type="checkbox"
							checked={todo.checked}
							onChange={() =>
								onToggle({ phase: phaseNumber, todoIdx: idx, checked: !todo.checked })
							}
							className="mt-0.5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
							style={{
								accentColor: COLORS.holoBase,
								outlineColor: COLORS.holoBase,
								// Minimum 24×24px click target via width+height padding
								width: 14,
								height: 14,
							}}
						/>
						<span
							className="flex-1 cursor-pointer select-none"
							onClick={() =>
								onToggle({ phase: phaseNumber, todoIdx: idx, checked: !todo.checked })
							}
							style={{
								textDecoration: todo.checked ? "line-through" : "none",
								wordBreak: "break-word",
							}}
						>
							{todo.text}
						</span>
					</div>
				),
			)}
		</div>
	);
}
