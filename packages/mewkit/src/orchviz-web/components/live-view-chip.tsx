/**
 * LiveViewChip — persistent read-only signal anchored top-right of the canvas.
 *
 * Stateless badge. `pointer-events: none` so it never blocks canvas interaction.
 * Optional `subtitle` shows last-clicked drawer context (plan title · phase n: title).
 */

import { COLORS } from "@/lib/colors";

interface LiveViewChipProps {
	/** Optional second line: last-clicked context from drawer navigation. */
	subtitle?: string | null;
}

export function LiveViewChip({ subtitle }: LiveViewChipProps) {
	return (
		<div
			aria-hidden="true"
			className="absolute top-3 right-3 z-10 px-2 py-1 rounded"
			style={{
				background: "rgba(8, 12, 24, 0.7)",
				border: `1px solid ${COLORS.glassBorder}`,
				color: COLORS.holoBase,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
				fontSize: 10,
				letterSpacing: "0.1em",
				textTransform: "uppercase",
				cursor: "default",
				pointerEvents: "none",
				maxWidth: 320,
				lineHeight: 1.3,
			}}
		>
			<div>Live view</div>
			{subtitle ? (
				<div
					className="truncate"
					style={{
						color: COLORS.textDim,
						fontSize: 9,
						marginTop: 2,
						textTransform: "none",
						letterSpacing: "0.05em",
					}}
					title={subtitle}
				>
					{subtitle}
				</div>
			) : null}
		</div>
	);
}
