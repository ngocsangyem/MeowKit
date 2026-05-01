/**
 * AgentVisualizer — composition root, graph-first layout.
 *
 * Grid: TopStrip (auto) / canvas+optional-transcript (1fr) / BottomBar (auto).
 * No left/right split. The old inline plan grid is removed; plan structure
 * now lives in the hamburger drawer (PlanSwitcher) as a hierarchical tree.
 *
 * - selectedSlug: lifted state shared with TopStrip + PlanSwitcher drawer.
 * - liveViewSubtitle: last-clicked drawer context, displayed under the
 *   "Live view" chip; cleared when slug changes.
 * - Stale-slug recovery: useActivePlan empty for a non-null slug → clear.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentSimulation } from "@/hooks/use-agent-simulation";
import { useEventSource } from "@/hooks/use-event-source";
import { useActivePlan } from "@/hooks/use-active-plan";
import { AgentCanvas } from "./agent-canvas";
import { TranscriptPanel } from "./transcript-panel";
import { TopStrip } from "./top-strip";
import { BottomBar } from "./bottom-bar";
import { GateDrawer } from "./drawers/gate-drawer";
import { LiveViewChip } from "./live-view-chip";
import { COLORS } from "@/lib/colors";
import { loadSelectedSlug, saveSelectedSlug } from "@/lib/selected-slug-store";
import { ToastProvider } from "./toast";

export function AgentVisualizer() {
	const { pendingEvents, consumeEvents, connectionStatus } = useEventSource("/events");
	const sessionFilterRef = useRef<string | null>(null);
	const externalEvents = pendingEvents as unknown as readonly import("@/lib/agent-types").SimulationEvent[];
	const onConsumed = (): void => consumeEvents(pendingEvents.length);

	const { frameRef, agents, conversations, play } = useAgentSimulation({
		useMockData: false,
		externalEvents,
		onExternalEventsConsumed: onConsumed,
		sessionFilter: null,
		sessionFilterRef,
		disable1MContext: false,
	});

	const [selectedSlug, setSelectedSlug] = useState<string | null>(() => loadSelectedSlug());
	const [liveViewSubtitle, setLiveViewSubtitle] = useState<string | null>(null);

	const handleSelectSlug = useCallback((slug: string | null): void => {
		setSelectedSlug(slug);
		saveSelectedSlug(slug);
		setLiveViewSubtitle(null);
	}, []);

	// Single useActivePlan call lifted here — passed to TopStrip + PlanSwitcher
	// so we have ONE polling effect, not multiple.
	const activePlan = useActivePlan(selectedSlug ?? undefined);

	// Stale-slug recovery: 404 on slug-targeted fetch → fall back to most-recent.
	const staleSlugs = useRef<Set<string>>(new Set());
	useEffect(() => {
		if (
			activePlan.status === "empty" &&
			selectedSlug !== null &&
			!staleSlugs.current.has(selectedSlug)
		) {
			staleSlugs.current.add(selectedSlug);
			handleSelectSlug(null);
		}
	}, [activePlan.status, selectedSlug, handleSelectSlug]);

	const [showTranscript, setShowTranscript] = useState(false);
	const [openGate, setOpenGate] = useState<"G1" | "G2" | null>(null);

	useEffect(() => {
		play();
	}, [play]);

	const sessionConversation = useMemo(() => {
		if (!showTranscript) return [];
		const all = Array.from(conversations.values()).flat();
		return all.sort((a, b) => a.timestamp - b.timestamp);
	}, [conversations, showTranscript]);

	const isEmpty = agents.size === 0;

	return (
		<ToastProvider>
			<div
				className="grid h-screen w-screen overflow-hidden relative"
				style={{
					gridTemplateRows: "auto 1fr auto",
					background: COLORS.void,
					fontFamily: "'SF Mono', 'Fira Code', monospace",
					minWidth: 1024,
				}}
			>
				<TopStrip
					onGateClick={(id) => setOpenGate(id)}
					selectedSlug={selectedSlug}
					onSelectSlug={handleSelectSlug}
					activePlan={activePlan}
					onLiveViewSubtitle={setLiveViewSubtitle}
				/>

				<main
					className="grid overflow-hidden"
					style={{
						gridTemplateRows: showTranscript ? "1fr 280px" : "1fr",
						borderTop: `1px solid ${COLORS.panelSeparator}`,
					}}
				>
					<div className="relative overflow-hidden">
						<AgentCanvas simulationRef={frameRef} />
						<LiveViewChip subtitle={liveViewSubtitle} />
						{isEmpty && (
							<div
								className="absolute inset-0 flex items-center justify-center pointer-events-none"
								style={{ color: "#66ccff80" }}
							>
								<div className="text-center">
									<div className="text-[11px]">
										{connectionStatus === "connected"
											? "WAITING FOR AGENT ACTIVITY"
											: "CONNECTING…"}
									</div>
									<div className="mt-1 text-[10px]" style={{ color: "#66ccff40" }}>
										Run a Claude Code task to see live activity.
									</div>
								</div>
							</div>
						)}
					</div>
					{showTranscript && (
						<TranscriptPanel
							conversation={sessionConversation}
							visible={showTranscript}
							onClose={() => setShowTranscript(false)}
						/>
					)}
				</main>

				<BottomBar
					connectionStatus={connectionStatus}
					agentCount={agents.size}
					showTranscript={showTranscript}
					onToggleTranscript={() => setShowTranscript((v) => !v)}
				/>

				<GateDrawer gate={openGate} onClose={() => setOpenGate(null)} />
			</div>
		</ToastProvider>
	);
}
