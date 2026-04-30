/**
 * Gate diamond (G1 / G2). Rotated CSS square with status color + click handler.
 */

import { COLORS } from "@/lib/colors";

interface GateDiamondProps {
	id: "G1" | "G2";
	verdict: "PASS" | "WARN" | "FAIL" | null;
	approved?: boolean;
	onClick?: (id: "G1" | "G2") => void;
}

function colorFor(verdict: GateDiamondProps["verdict"], approved: boolean | undefined): string {
	if (verdict === "PASS" || approved === true) return COLORS.complete;
	if (verdict === "WARN") return COLORS.tool_calling;
	if (verdict === "FAIL") return COLORS.error;
	return COLORS.textMuted;
}

function labelFor(props: GateDiamondProps): string {
	if (props.verdict) return props.verdict;
	if (props.approved === true) return "OK";
	return "—";
}

export function GateDiamond(props: GateDiamondProps) {
	const color = colorFor(props.verdict, props.approved);
	const label = labelFor(props);
	return (
		<button
			type="button"
			className="inline-flex items-center justify-center"
			style={{
				width: 28,
				height: 28,
				cursor: "pointer",
				background: "transparent",
				border: "none",
				padding: 0,
			}}
			onClick={() => props.onClick?.(props.id)}
			aria-label={`Gate ${props.id} — ${label}`}
			title={`Gate ${props.id}: ${label}`}
		>
			<span
				style={{
					display: "inline-block",
					width: 18,
					height: 18,
					transform: "rotate(45deg)",
					background: COLORS.glassBg,
					border: `2px solid ${color}`,
					boxShadow: props.verdict === "FAIL" ? `0 0 8px ${color}` : "none",
				}}
			/>
			<span
				className="absolute mt-12 text-[9px] font-mono uppercase tracking-wider"
				style={{ color, marginLeft: -28, marginTop: 22 }}
			>
				{props.id}
			</span>
		</button>
	);
}
