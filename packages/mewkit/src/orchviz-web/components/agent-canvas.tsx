/**
 * Slim AgentCanvas — Canvas2D + d3-force renderer reading frameRef.
 *
 * Inspired by patoles/agent-flow @ 59ccf4e (canvas.tsx). License Apache-2.0
 * (see ../../../NOTICE). v1.1 sizes from parent dims (was window) so the canvas
 * fits inside the new grid sidebar.
 *
 * Per red-team H4: defensive zero-size guard at top of draw() loop + sync
 * redraw triggered from ResizeObserver to avoid first-paint flicker when the
 * grid hasn't measured yet.
 */

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { SimulationState } from "@/hooks/simulation/types";
import { COLORS } from "@/lib/colors";
import {
	drawAgents,
	drawEdges,
	drawParticles,
	drawToolCalls,
	drawDiscoveries,
	drawDiscoveryConnections,
	drawMessageBubblesWorld,
	buildEdgeMap,
	getActiveEdgeIds,
} from "./canvas/index.js";
import { drawEffects, type VisualEffect } from "./canvas/draw-effects.js";
import { findAgentAt } from "./canvas/hit-detection";

interface AgentCanvasProps {
	simulationRef: MutableRefObject<SimulationState>;
	/** Called with the agent id when the canvas is clicked over an agent node. */
	onAgentClick?: (agentId: string) => void;
}

export function AgentCanvas({ simulationRef, onAgentClick }: AgentCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const visualEffectsRef = useRef<VisualEffect[]>([]);
	const edgeMapCacheRef = useRef<{ source: unknown; map: ReturnType<typeof buildEdgeMap> }>({
		source: null,
		map: new Map(),
	});
	// Camera transform (CSS pixels) — exposed via ref so click→world hit-test
	// can read the same value the renderer uses.
	const camRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
	// Latest onAgentClick — read inside the listener without re-attaching.
	const onAgentClickRef = useRef<typeof onAgentClick>(onAgentClick);
	useEffect(() => {
		onAgentClickRef.current = onAgentClick;
	}, [onAgentClick]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const parent = canvas.parentElement;
		if (!parent) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let raf = 0;
		const dpr = window.devicePixelRatio || 1;
		const cam = camRef.current;
		let parentW = 0;
		let parentH = 0;

		const resize = (): void => {
			const rect = parent.getBoundingClientRect();
			parentW = Math.max(0, Math.floor(rect.width));
			parentH = Math.max(0, Math.floor(rect.height));
			canvas.width = parentW * dpr;
			canvas.height = parentH * dpr;
			canvas.style.width = `${parentW}px`;
			canvas.style.height = `${parentH}px`;
			// Sync redraw to avoid flicker before next rAF (red-team H4).
			if (parentW > 0 && parentH > 0) drawOnce();
		};

		const drawOnce = (): void => {
			const state = simulationRef.current;
			if (!state || !state.agents) return;
			// Zero-size guard (red-team H4) — first paint may not have measured.
			if (canvas.width === 0 || canvas.height === 0) return;

			ctx.fillStyle = COLORS.void;
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			ctx.save();
			ctx.scale(dpr, dpr);

			if (state.agents.size > 0) {
				let cx = 0;
				let cy = 0;
				for (const a of state.agents.values()) {
					cx += a.x;
					cy += a.y;
				}
				cam.x = parentW / 2 - cx / state.agents.size;
				cam.y = parentH / 2 - cy / state.agents.size;
			}
			ctx.translate(cam.x, cam.y);

			const time = state.currentTime ?? 0;
			const edges = state.edges ?? [];
			if (edgeMapCacheRef.current.source !== edges) {
				edgeMapCacheRef.current = { source: edges, map: buildEdgeMap(edges) };
			}
			const edgeMap = edgeMapCacheRef.current.map;
			const activeEdgeIds = getActiveEdgeIds(state.particles ?? []);

			drawEdges(ctx, edges, state.agents, state.toolCalls, activeEdgeIds, time);
			drawDiscoveryConnections(ctx, state.discoveries ?? [], state.agents);
			drawToolCalls(ctx, state.toolCalls, time, null);
			drawAgents(ctx, state.agents, null, null, false, time);
			drawParticles(ctx, state.particles ?? [], edgeMap, state.agents, state.toolCalls, time);
			drawDiscoveries(ctx, state.discoveries ?? [], state.agents, null);
			drawMessageBubblesWorld(ctx, state.agents, time);
			drawEffects(ctx, visualEffectsRef.current);

			ctx.restore();
		};

		const tick = (): void => {
			raf = requestAnimationFrame(tick);
			drawOnce();
		};

		const ro = new ResizeObserver(() => resize());
		ro.observe(parent);
		resize();
		tick();

		const onClick = (ev: MouseEvent): void => {
			const handler = onAgentClickRef.current;
			if (!handler) return;
			const state = simulationRef.current;
			if (!state || !state.agents) return;
			const rect = canvas.getBoundingClientRect();
			// CSS pixels relative to canvas; cam is also CSS pixels (post ctx.scale(dpr)).
			const cssX = ev.clientX - rect.left;
			const cssY = ev.clientY - rect.top;
			const worldX = cssX - cam.x;
			const worldY = cssY - cam.y;
			const id = findAgentAt(worldX, worldY, state.agents);
			if (id) handler(id);
		};
		canvas.addEventListener("click", onClick);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			canvas.removeEventListener("click", onClick);
		};
	}, [simulationRef]);

	return (
		<canvas
			ref={canvasRef}
			style={{ display: "block", background: COLORS.void }}
		/>
	);
}
