/**
 * AgentVisualizer — composition root with v1.1 plan-aware grid layout.
 *
 * Grid: TopStrip (auto) / MainGrid 60-40 (PlanTable | Canvas+Transcript) / BottomBar (auto).
 * GateDrawer overlays at z-50 when triggered. AgentCanvas demoted to right sidebar.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAgentSimulation } from "@/hooks/use-agent-simulation";
import { useEventSource } from "@/hooks/use-event-source";
import { AgentCanvas } from "./agent-canvas";
import { TranscriptPanel } from "./transcript-panel";
import { TopStrip } from "./top-strip";
import { PlanTable } from "./plan-table";
import { BottomBar } from "./bottom-bar";
import { GateDrawer } from "./drawers/gate-drawer";
import { COLORS } from "@/lib/colors";

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

	const [showTranscript, setShowTranscript] = useState(true);
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
		<div
			className="grid h-screen w-screen overflow-hidden relative"
			style={{
				gridTemplateRows: "auto 1fr auto",
				background: COLORS.void,
				fontFamily: "'SF Mono', 'Fira Code', monospace",
				minWidth: 1024,
			}}
		>
			<TopStrip onGateClick={(id) => setOpenGate(id)} />

			<main
				className="grid overflow-hidden"
				style={{
					gridTemplateColumns: "60% 40%",
					borderTop: `1px solid ${COLORS.panelSeparator}`,
				}}
			>
				<section
					className="overflow-hidden"
					style={{ borderRight: `1px solid ${COLORS.panelSeparator}` }}
				>
					<PlanTable />
				</section>
				<section
					className="grid overflow-hidden"
					style={{ gridTemplateRows: showTranscript ? "1fr 280px" : "1fr" }}
				>
					<div className="relative overflow-hidden">
						<AgentCanvas simulationRef={frameRef} />
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
				</section>
			</main>

			<BottomBar
				connectionStatus={connectionStatus}
				agentCount={agents.size}
				showTranscript={showTranscript}
				onToggleTranscript={() => setShowTranscript((v) => !v)}
			/>

			<GateDrawer gate={openGate} onClose={() => setOpenGate(null)} />
		</div>
	);
}
