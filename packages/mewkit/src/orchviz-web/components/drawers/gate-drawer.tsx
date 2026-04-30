/**
 * GateDrawer — slide-in drawer rendering Gate state from /api/overlays.
 *
 * v1.1 minimal: shows the gate verdict + plan title + linked file paths from
 * frontmatter only. No file-content fetch — that needs a new endpoint and is
 * deferred to v1.2.
 */

import { useEffect } from "react";
import { COLORS } from "@/lib/colors";
import { useOverlays } from "@/hooks/use-overlays";

interface GateDrawerProps {
	gate: "G1" | "G2" | null;
	onClose: () => void;
}

export function GateDrawer({ gate, onClose }: GateDrawerProps) {
	useEffect(() => {
		if (!gate) return;
		const handler = (ev: KeyboardEvent): void => {
			if (ev.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [gate, onClose]);

	const overlays = useOverlays();
	if (!gate) return null;

	const isG1 = gate === "G1";
	const stateLabel = isG1
		? overlays.gate1?.approved
			? "approved"
			: "pending"
		: overlays.gate2?.verdict ?? "pending";
	const name = isG1 ? overlays.gate1?.name : overlays.gate2?.name;

	return (
		<div
			className="absolute inset-0 z-50 flex justify-end"
			style={{ background: "rgba(5,5,16,0.65)" }}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className="h-full w-[420px] flex flex-col"
				style={{
					background: COLORS.panelBg,
					borderLeft: `1px solid ${COLORS.glassBorder}`,
					fontFamily: "'SF Mono', 'Fira Code', monospace",
				}}
				role="dialog"
				aria-label={`Gate ${gate} details`}
			>
				<div
					className="flex items-center justify-between px-3 py-2 border-b"
					style={{ borderColor: COLORS.panelSeparator }}
				>
					<span className="text-[11px] uppercase tracking-widest" style={{ color: COLORS.holoBase }}>
						{isG1 ? "Gate 1 — Plan" : "Gate 2 — Review"}
					</span>
					<button
						type="button"
						onClick={onClose}
						className="px-2 text-[14px]"
						style={{
							background: "transparent",
							border: "none",
							color: COLORS.scrollBtnText,
							cursor: "pointer",
						}}
						aria-label="Close drawer"
					>
						×
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-4 space-y-3 text-[12px]">
					<div>
						<div className="text-[10px] uppercase" style={{ color: COLORS.textMuted }}>
							status
						</div>
						<div style={{ color: COLORS.holoBright }}>{stateLabel}</div>
					</div>
					{name && (
						<div>
							<div className="text-[10px] uppercase" style={{ color: COLORS.textMuted }}>
								{isG1 ? "plan" : "verdict file"}
							</div>
							<div style={{ color: COLORS.textPrimary }}>{name}</div>
						</div>
					)}
					<div className="pt-3 text-[10px]" style={{ color: COLORS.textDim }}>
						v1.1 shows summary fields only. v1.2 will render the full plan.md / verdict.md file
						content here. For now, open the file in your editor:
						<div className="mt-1">
							<code style={{ color: COLORS.holoBase }}>
								tasks/{isG1 ? "plans" : "reviews"}/...
							</code>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
