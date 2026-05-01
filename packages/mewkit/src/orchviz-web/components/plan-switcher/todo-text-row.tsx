/**
 * TodoTextRow — read-only todo line inside the drawer tree.
 *
 * No form inputs, no toggle handler. Glyph-only: ▢ pending, ☑ done.
 * Done todos render with line-through and reduced opacity.
 *
 * Click delegates to the parent phase's onPhaseClick (drawer navigates by
 * phase, never by individual todo — todo IDs aren't part of the routing layer).
 */

import { COLORS } from "@/lib/colors";
import type { PlanTodo } from "@/hooks/use-active-plan";

interface TodoTextRowProps {
	todo: PlanTodo;
	onClick?: () => void;
}

export function TodoTextRow({ todo, onClick }: TodoTextRowProps) {
	const glyph = todo.checked ? "☑" : "▢";
	return (
		<div
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : -1}
			onClick={onClick}
			onKeyDown={(e) => {
				if (!onClick) return;
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick();
				}
			}}
			className="flex items-start gap-2 py-1 text-[10px]"
			style={{
				paddingLeft: 32,
				paddingRight: 12,
				color: todo.checked ? COLORS.todoCompletedText : COLORS.textPrimary,
				opacity: todo.checked ? 0.6 : 1,
				cursor: onClick ? "pointer" : "default",
				textDecoration: todo.checked ? "line-through" : "none",
				lineHeight: 1.4,
			}}
		>
			<span style={{ color: todo.checked ? COLORS.complete : COLORS.holoBase }}>
				{glyph}
			</span>
			<span className="flex-1">{todo.text}</span>
		</div>
	);
}
