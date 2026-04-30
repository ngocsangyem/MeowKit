/**
 * Empty state shown when /api/plan returns null. Defensive copy per red-team H7
 * — points at editing phase files directly as the canonical path.
 */

import { COLORS } from "@/lib/colors";

export function EmptyState() {
	return (
		<div
			className="h-full flex items-center justify-center px-6"
			style={{
				color: COLORS.textDim,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
			}}
		>
			<div className="text-center max-w-md">
				<div className="text-[12px]" style={{ color: COLORS.holoBase }}>
					No active plan in tasks/plans/
				</div>
				<div className="mt-3 text-[11px]" style={{ color: COLORS.textDim }}>
					Create one by editing{" "}
					<code style={{ color: COLORS.holoBright }}>
						tasks/plans/&lt;YYMMDD&gt;-&lt;slug&gt;/plan.md
					</code>{" "}
					directly, or run{" "}
					<code style={{ color: COLORS.holoBright }}>npx mewkit task new --type feature "..."</code>{" "}
					if available.
				</div>
			</div>
		</div>
	);
}

export function LoadingState() {
	return (
		<div className="px-3 py-2 space-y-2" style={{ fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
			{[1, 2, 3].map((i) => (
				<div
					key={i}
					className="h-6 rounded"
					style={{ background: COLORS.toggleInactive, opacity: 0.4 + i * 0.1 }}
				/>
			))}
		</div>
	);
}
