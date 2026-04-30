/**
 * Read-only todo checklist. Per red-team M3, the title attribute lives on the
 * wrapper div (not the disabled input) for Firefox-compatible tooltips.
 */

import { COLORS } from "@/lib/colors";
import type { PlanTodo } from "@/hooks/use-active-plan";

const HINT = "edit phase file directly to mark complete (v1.2 will support inline editing)";

export function TodoList({ todos }: { todos: PlanTodo[] }) {
	if (todos.length === 0) {
		return (
			<div className="px-2 py-1 text-[10px]" style={{ color: COLORS.textDim }}>
				(no todos)
			</div>
		);
	}
	return (
		<div className="px-2 py-1 space-y-0.5">
			{todos.map((todo, idx) => (
				<div
					key={`${idx}-${todo.text.slice(0, 20)}`}
					title={HINT}
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
			))}
		</div>
	);
}
