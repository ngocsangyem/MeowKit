/**
 * StatusBanner — top-of-screen meowkit overlays (gates, model, phase, cost).
 * Reads from /api/overlays via useOverlays.
 */

import { COLORS } from "@/lib/colors";
import { useOverlays } from "@/hooks/use-overlays";

function Pill({ label, value, color }: { label: string; value: string; color: string }) {
	return (
		<span
			className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px]"
			style={{
				background: COLORS.glassBg,
				border: `1px solid ${color}55`,
				color: color,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
			}}
		>
			<span style={{ color: COLORS.textDim }}>{label}</span>
			<span>{value}</span>
		</span>
	);
}

export function StatusBanner() {
	const o = useOverlays();
	const items: { label: string; value: string; color: string }[] = [];
	if (o.phase) items.push({ label: "phase", value: o.phase, color: COLORS.holoBase });
	if (o.model) items.push({ label: "model", value: o.model, color: COLORS.holoBright });
	if (o.gate1)
		items.push({
			label: "gate1",
			value: o.gate1.approved ? "✓ approved" : `${o.gate1.name}`,
			color: o.gate1.approved ? COLORS.complete : COLORS.tool_calling,
		});
	if (o.gate2)
		items.push({
			label: "gate2",
			value: o.gate2.verdict,
			color: o.gate2.verdict === "PASS" ? COLORS.complete : COLORS.error,
		});
	if (o.cost)
		items.push({
			label: "cost",
			value: `${o.cost.tokens.toLocaleString()} · $${o.cost.usd.toFixed(2)}`,
			color: COLORS.costText,
		});

	if (items.length === 0) return <></>;

	return (
		<div
			className="absolute top-3 left-3 z-20 flex flex-wrap gap-2 pointer-events-none"
			style={{ maxWidth: "70vw" }}
		>
			{items.map((it) => (
				<Pill key={it.label} {...it} />
			))}
		</div>
	);
}
