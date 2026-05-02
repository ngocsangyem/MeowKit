/**
 * Body for `ask_user_question` (AskUserQuestion tool_use pending).
 *
 * Renders the documented schema: 1–4 questions × 2–4 options each.
 * Critical: option rows are STATIC — no onClick, default cursor, no hover.
 * The user submits the answer in their terminal, not here.
 *
 * `header` (max 12 chars per docs) renders as a chip above the question.
 * `multiSelect` swaps the glyph from ◯ (single) to ☐ (multi) but never shows
 * a checked state since the UI is read-only.
 */

import { COLORS } from "@/lib/colors";
import type { Agent } from "@/lib/agent-types";
import { PauseFooter } from "./pause-footer";

interface PauseAskUserQuestionBodyProps {
	agent: Agent;
}

export function PauseAskUserQuestionBody({ agent }: PauseAskUserQuestionBodyProps) {
	const questions = agent.pauseDetail?.questions ?? [];

	return (
		<>
			<div className="flex-1 overflow-y-auto p-4 text-[12px]" style={{ color: COLORS.textPrimary }}>
				{questions.length === 0 && (
					<div style={{ color: COLORS.textDim }}>
						(No question payload — Claude is waiting for your answer in the terminal.)
					</div>
				)}
				{questions.map((q, qi) => (
					<div key={qi} className="mb-5">
						{q.header && (
							<span
								className="inline-block mb-2 px-2 py-0.5 text-[10px] uppercase tracking-wider rounded"
								style={{
									background: COLORS.pausedBg,
									border: `1px solid ${COLORS.pausedBorder}`,
									color: COLORS.paused,
								}}
							>
								{q.header}
							</span>
						)}
						<div style={{ color: COLORS.holoBright, marginBottom: 8 }}>
							{q.question}
						</div>
						<ul className="space-y-1.5">
							{q.options.map((opt, oi) => (
								<li
									key={oi}
									className="flex items-start gap-2 text-[12px]"
									style={{ color: COLORS.textPrimary, cursor: "default" }}
								>
									<span style={{ color: COLORS.pausedDim, flexShrink: 0 }}>
										{q.multiSelect ? "☐" : "◯"}
									</span>
									<span>{opt}</span>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
			<PauseFooter />
		</>
	);
}
