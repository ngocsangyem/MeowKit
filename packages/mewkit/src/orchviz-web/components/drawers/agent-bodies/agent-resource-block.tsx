/**
 * AgentResourceBlock — token bar (context breakdown segments), tool count,
 * time alive. Read-only. Pure derivation from the live Agent state.
 */

import { COLORS, contextSegments } from "@/lib/colors";
import { MK_TOKENS } from "@/lib/tokens.generated";
import type { Agent } from "@/lib/agent-types";

interface AgentResourceBlockProps {
	agent: Agent;
	now: number;
}

function formatDuration(ms: number): string {
	const sec = Math.max(0, Math.floor(ms / 1000));
	if (sec < 60) return `${sec}s`;
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	if (m < 60) return `${m}m ${s}s`;
	const h = Math.floor(m / 60);
	return `${h}h ${m % 60}m`;
}

export function AgentResourceBlock({ agent, now }: AgentResourceBlockProps) {
	const segments = contextSegments(agent.contextBreakdown);
	const total = Math.max(1, agent.tokensMax);
	const used = Math.min(total, agent.tokensUsed);
	const usedPct = Math.round((used / total) * 100);
	const elapsed = agent.spawnTime > 0 ? now - agent.spawnTime : 0;

	return (
		<section className="px-4 py-3 border-b" style={{ borderColor: COLORS.panelSeparator }}>
			<div
				className="text-[10px] uppercase tracking-widest mb-2"
				style={{ color: COLORS.textMuted, fontFamily: MK_TOKENS.typography.family.mono }}
			>
				Resources
			</div>

			<div className="flex items-baseline justify-between text-[11px] mb-1">
				<span style={{ color: COLORS.textDim }}>Context</span>
				<span style={{ color: COLORS.textPrimary, fontFamily: MK_TOKENS.typography.family.mono }}>
					{used.toLocaleString()} / {total.toLocaleString()} ({usedPct}%)
				</span>
			</div>
			<div
				className="w-full overflow-hidden flex"
				style={{
					height: 6,
					background: COLORS.holoBg05,
					borderRadius: MK_TOKENS.radius.sm,
				}}
				aria-label="Context usage breakdown"
			>
				{segments.map((seg, i) => {
					const w = (seg.value / total) * 100;
					if (w <= 0) return null;
					return (
						<span
							key={i}
							style={{ width: `${w}%`, background: seg.color, height: "100%" }}
						/>
					);
				})}
			</div>

			<div className="grid grid-cols-2 gap-3 mt-3 text-[11px]">
				<Stat label="Tool calls" value={String(agent.toolCalls)} />
				<Stat label="Time alive" value={formatDuration(elapsed)} />
			</div>
		</section>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<div
				className="text-[9px] uppercase tracking-widest"
				style={{ color: COLORS.textMuted, fontFamily: MK_TOKENS.typography.family.mono }}
			>
				{label}
			</div>
			<div
				className="text-[12px]"
				style={{ color: COLORS.textPrimary, fontFamily: MK_TOKENS.typography.family.mono }}
			>
				{value}
			</div>
		</div>
	);
}
