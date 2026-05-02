/**
 * Single-source-of-truth footer for the PauseDetailDrawer.
 *
 * The verbatim copy "Handled outside UI · Respond in your terminal · Orchviz
 * is read-only" is the explicit signal that this UI cannot resume Claude.
 * Any per-reason variant (e.g. "Resolve the hook condition") goes in the
 * `extra` slot above the verbatim line.
 */

import { COLORS } from "@/lib/colors";

interface PauseFooterProps {
	extra?: string;
}

export function PauseFooter({ extra }: PauseFooterProps) {
	return (
		<div
			style={{
				borderTop: `1px solid ${COLORS.holoBorder06}`,
				padding: "12px 16px",
				color: COLORS.textDim,
				fontSize: 11,
				lineHeight: 1.45,
			}}
		>
			{extra && <div style={{ marginBottom: 4 }}>{extra}</div>}
			<div>
				Handled outside UI · Respond in your terminal · Orchviz is read-only
			</div>
		</div>
	);
}
