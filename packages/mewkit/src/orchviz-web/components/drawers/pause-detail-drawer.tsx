/**
 * PauseDetailDrawer — non-modal right-side drawer surfacing pause reason + detail.
 *
 * Shell pattern: copied from PlanSwitcher (createPortal + slide animation),
 * NOT GateDrawer (full-viewport scrim modal — wrong reference per red-team #10).
 *
 * - Mounted via createPortal into document.body at z-50
 * - position: fixed; right: 0; width: 420px
 * - 220ms cubic-bezier(0.2, 0, 0, 1) slide on transform
 * - document-level mousedown for click-outside, document-level keydown for ESC
 * - Auto-close handled by parent via `open` prop transition (parent watches
 *   the represented agent's state)
 *
 * Read-only honesty: NO submit affordances. Footer copy is the single source
 * of truth that the user must respond in their terminal.
 */

import { useEffect, useState } from "react";
import { COLORS } from "@/lib/colors";
import type { Agent } from "@/lib/agent-types";
import { REASON_HEADER } from "@/lib/pause-labels";
import { PausePermissionBody } from "./pause-bodies/pause-permission-body";
import { PauseAskUserQuestionBody } from "./pause-bodies/pause-ask-user-question-body";
import { PausePlanModeBody } from "./pause-bodies/pause-plan-mode-body";
import { PauseRejectedBody } from "./pause-bodies/pause-rejected-body";
import { PauseHookBlockedBody } from "./pause-bodies/pause-hook-blocked-body";
import { PauseListBody } from "./pause-bodies/pause-list-body";
import { PauseDrawerPortal } from "./pause-drawer-portal";

const PANEL_ID = "pause-detail-drawer";
const HEADER_ID = "pause-detail-drawer-heading";

interface PauseDetailDrawerProps {
	open: boolean;
	onClose: () => void;
	/** Active agent — null while in list view (≥2 paused). */
	agent: Agent | null;
	/** All currently paused agents. List view rendered when length ≥ 2 AND agent is null. */
	pausedAgents: Agent[];
	/** Switch to a specific agent's detail (called from list-body row clicks). */
	onSelectAgent: (name: string) => void;
	/** Return to list view from a single-agent detail. */
	onBackToList: () => void;
}

export function PauseDetailDrawer({
	open,
	onClose,
	agent,
	pausedAgents,
	onSelectAgent,
	onBackToList,
}: PauseDetailDrawerProps) {
	const [now, setNow] = useState(() => Date.now());

	// 1s ticker — only while open, only when there's something with elapsed time.
	useEffect(() => {
		if (!open) return;
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [open]);

	const isListView = open && agent === null && pausedAgents.length >= 2;
	const showsBack = open && agent !== null && pausedAgents.length >= 2;

	return (
		<PauseDrawerPortal open={open} onClose={onClose}>
			{open && (
				<div className="flex flex-col h-full" id={PANEL_ID} aria-labelledby={HEADER_ID}>
					{/* amber bar */}
					<div style={{ height: 4, background: COLORS.paused, flexShrink: 0 }} />
					<DrawerHeader
						headerId={HEADER_ID}
						isListView={isListView}
						agent={agent}
						pausedCount={pausedAgents.length}
						now={now}
						showsBack={showsBack}
						onBack={onBackToList}
						onClose={onClose}
					/>
					{isListView ? (
						<PauseListBody agents={pausedAgents} now={now} onSelect={onSelectAgent} />
					) : agent ? (
						<DrawerBody agent={agent} />
					) : (
						<EmptyBody onClose={onClose} />
					)}
				</div>
			)}
		</PauseDrawerPortal>
	);
}

interface DrawerHeaderProps {
	headerId: string;
	isListView: boolean;
	agent: Agent | null;
	pausedCount: number;
	now: number;
	showsBack: boolean;
	onBack: () => void;
	onClose: () => void;
}

function DrawerHeader({
	headerId,
	isListView,
	agent,
	pausedCount,
	now,
	showsBack,
	onBack,
	onClose,
}: DrawerHeaderProps) {
	let titleNode: React.ReactNode;
	if (isListView) {
		titleNode = `⏸ ${pausedCount} agents paused`;
	} else if (agent) {
		const reason = agent.pauseReason ?? "permission_request";
		const startedAt = agent.pauseStartedAt ?? now;
		const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
		titleNode = (
			<span>
				⏸ {REASON_HEADER[reason]}
				<span style={{ color: COLORS.textDim, marginLeft: 8 }}>
					{agent.name} · {elapsedSec}s
				</span>
			</span>
		);
	} else {
		titleNode = "⏸ Paused";
	}

	return (
		<div
			className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
			style={{ borderColor: COLORS.panelSeparator }}
		>
			<div className="flex items-center gap-3">
				{showsBack && (
					<button
						type="button"
						onClick={onBack}
						className="text-[11px]"
						style={{
							background: "transparent",
							border: "none",
							color: COLORS.scrollBtnText,
							cursor: "pointer",
						}}
						aria-label="Back to list"
					>
						← Back
					</button>
				)}
				<span
					id={headerId}
					className="text-[12px] uppercase tracking-widest"
					style={{ color: COLORS.paused }}
				>
					{titleNode}
				</span>
			</div>
			<button
				type="button"
				onClick={onClose}
				className="px-2 text-[16px]"
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
	);
}

function DrawerBody({ agent }: { agent: Agent }) {
	const reason = agent.pauseReason ?? "permission_request";
	switch (reason) {
		case "permission_request":
			return <PausePermissionBody agent={agent} />;
		case "ask_user_question":
			return <PauseAskUserQuestionBody agent={agent} />;
		case "plan_mode_review":
			return <PausePlanModeBody agent={agent} />;
		case "tool_rejected":
			return <PauseRejectedBody agent={agent} />;
		case "hook_blocked":
			return <PauseHookBlockedBody agent={agent} />;
	}
}

function EmptyBody({ onClose }: { onClose: () => void }) {
	// Reachable when the represented pause cleared between render frames; auto-close
	// effect in parent will collapse this within a tick. Render harmless placeholder.
	return (
		<div className="flex-1 flex items-center justify-center p-4 text-[11px]" style={{ color: COLORS.textDim }}>
			<div className="text-center">
				<div>No paused agents.</div>
				<button
					type="button"
					onClick={onClose}
					className="mt-3 px-3 py-1 text-[11px]"
					style={{
						background: COLORS.toggleActive,
						border: `1px solid ${COLORS.toggleBorder}`,
						color: COLORS.holoBase,
						cursor: "pointer",
					}}
				>
					Close
				</button>
			</div>
		</div>
	);
}

