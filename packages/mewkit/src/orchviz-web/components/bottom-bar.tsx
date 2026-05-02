import { COLORS } from "@/lib/colors";
import type { ConnectionStatus } from "@/lib/bridge-types";

interface BottomBarProps {
	connectionStatus: ConnectionStatus;
	agentCount: number;
	showTranscript: boolean;
	onToggleTranscript: () => void;
	/** Phase-05: number of currently paused agents — drives the inline ⏸ PAUSED indicator. */
	pausedCount?: number;
}

export function BottomBar({
	connectionStatus,
	agentCount,
	showTranscript,
	onToggleTranscript,
	pausedCount = 0,
}: BottomBarProps) {
	const dotColor = connectionStatus === "connected" ? COLORS.complete : COLORS.error;
	return (
		<div
			className="flex items-center gap-3 px-3 py-1.5 text-[10px]"
			style={{
				background: COLORS.panelBg,
				borderTop: `1px solid ${COLORS.panelSeparator}`,
				color: COLORS.textDim,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
			}}
		>
			<span style={{ color: dotColor }}>● {connectionStatus.toUpperCase()}</span>
			<span>{agentCount} agents</span>
			{pausedCount > 0 && (
				<span className="inline-flex items-center" style={{ color: COLORS.paused }}>
					<span className="orchviz-paused-dot" aria-hidden="true" />
					PAUSED{pausedCount > 1 ? ` · ${pausedCount}` : ""}
				</span>
			)}
			<span className="flex-1" />
			<button
				type="button"
				onClick={onToggleTranscript}
				className="px-2 py-0.5 rounded"
				style={{
					background: showTranscript ? COLORS.toggleActive : COLORS.toggleInactive,
					border: `1px solid ${COLORS.toggleBorder}`,
					color: COLORS.scrollBtnText,
					cursor: "pointer",
				}}
			>
				{showTranscript ? "hide transcript" : "show transcript"}
			</button>
		</div>
	);
}
