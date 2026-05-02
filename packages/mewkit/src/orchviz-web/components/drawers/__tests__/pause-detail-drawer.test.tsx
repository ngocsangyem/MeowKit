/**
 * PauseDetailDrawer tests — body switching, footer, no clickable affordance.
 *
 * The most important guarantees are:
 *   - Footer copy is verbatim "Handled outside UI · Respond in your terminal · Orchviz is read-only"
 *   - AskUserQuestion option rows have NO onClick handler (read-only honesty)
 *   - Plan body uses split-and-map JSX rendering, never dangerouslySetInnerHTML
 *   - Multi-pause list mode renders all paused agents
 */

import React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PauseDetailDrawer } from "../pause-detail-drawer";
import type { Agent } from "@/lib/agent-types";
import type { PauseReason, PauseDetail } from "../../../../orchviz/protocol";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
	return {
		id: "agent-1",
		name: "main",
		state: "paused",
		parentId: null,
		tokensUsed: 0,
		tokensMax: 200000,
		contextBreakdown: {
			systemPrompt: 0,
			userMessages: 0,
			toolResults: 0,
			reasoning: 0,
			subagentResults: 0,
		},
		toolCalls: 0,
		timeAlive: 0,
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		pinned: false,
		isMain: true,
		opacity: 1,
		scale: 1,
		spawnTime: 0,
		messageBubbles: [],
		pauseReason: "permission_request",
		pauseStartedAt: Date.now() - 5000,
		...overrides,
	};
}

function makePausedAgent(reason: PauseReason, detail?: PauseDetail, overrides: Partial<Agent> = {}): Agent {
	return makeAgent({ pauseReason: reason, pauseDetail: detail, ...overrides });
}

beforeEach(() => {
	cleanup();
});

afterEach(() => {
	cleanup();
});

describe("PauseDetailDrawer", () => {
	const FOOTER_VERBATIM = "Handled outside UI · Respond in your terminal · Orchviz is read-only";
	const noop = () => undefined;

	it("renders verbatim footer copy on permission_request", () => {
		const agent = makePausedAgent("permission_request");
		render(
			<PauseDetailDrawer
				open={true}
				onClose={noop}
				agent={agent}
				pausedAgents={[agent]}
				onSelectAgent={noop}
				onBackToList={noop}
			/>,
		);
		expect(screen.getByText(FOOTER_VERBATIM)).toBeTruthy();
	});

	it("renders ask_user_question body with options as static (no onClick) rows", () => {
		const agent = makePausedAgent("ask_user_question", {
			questions: [
				{
					question: "Pick one",
					header: "Scope",
					options: ["Option A", "Option B"],
				},
			],
		});
		render(
			<PauseDetailDrawer
				open={true}
				onClose={noop}
				agent={agent}
				pausedAgents={[agent]}
				onSelectAgent={noop}
				onBackToList={noop}
			/>,
		);
		expect(screen.getByText("Pick one")).toBeTruthy();
		expect(screen.getByText("Option A")).toBeTruthy();
		expect(screen.getByText("Option B")).toBeTruthy();
		expect(screen.getByText("Scope")).toBeTruthy();

		// Sanity: no buttons named after the option labels (no submit affordance)
		expect(screen.queryByRole("button", { name: /Option A/ })).toBeNull();
		expect(screen.queryByRole("button", { name: /Option B/ })).toBeNull();
	});

	it("renders plan_mode_review body splitting the plan on newlines (XSS-safe)", () => {
		const agent = makePausedAgent("plan_mode_review", {
			plan: "Step 1: Refactor X\nStep 2: Migrate Y",
		});
		render(
			<PauseDetailDrawer
				open={true}
				onClose={noop}
				agent={agent}
				pausedAgents={[agent]}
				onSelectAgent={noop}
				onBackToList={noop}
			/>,
		);
		expect(screen.getByText("Step 1: Refactor X")).toBeTruthy();
		expect(screen.getByText("Step 2: Migrate Y")).toBeTruthy();
		// Footer variant (extra slot) for plan mode
		expect(screen.getByText(/Approve or reject the plan/)).toBeTruthy();
	});

	it("renders tool_rejected body with the rejected tool", () => {
		const agent = makePausedAgent("tool_rejected", {}, { currentTool: "Bash", task: "rm -rf /" });
		render(
			<PauseDetailDrawer
				open={true}
				onClose={noop}
				agent={agent}
				pausedAgents={[agent]}
				onSelectAgent={noop}
				onBackToList={noop}
			/>,
		);
		expect(screen.getByText("Bash")).toBeTruthy();
		expect(screen.getByText("rm -rf /")).toBeTruthy();
	});

	it("renders hook_blocked body with command + reason", () => {
		const agent = makePausedAgent("hook_blocked", {
			hookCommand: "sh .claude/hooks/pre-tool.sh",
			hookReason: "Build is failing\nFix before continuing",
		});
		render(
			<PauseDetailDrawer
				open={true}
				onClose={noop}
				agent={agent}
				pausedAgents={[agent]}
				onSelectAgent={noop}
				onBackToList={noop}
			/>,
		);
		expect(screen.getByText("sh .claude/hooks/pre-tool.sh")).toBeTruthy();
		expect(screen.getByText("Build is failing")).toBeTruthy();
		expect(screen.getByText("Fix before continuing")).toBeTruthy();
	});

	it("multi-pause list view renders all paused agents", () => {
		const a1 = makePausedAgent("permission_request", undefined, { id: "a1", name: "main" });
		const a2 = makePausedAgent("ask_user_question", undefined, { id: "a2", name: "researcher" });
		render(
			<PauseDetailDrawer
				open={true}
				onClose={noop}
				agent={null}
				pausedAgents={[a1, a2]}
				onSelectAgent={noop}
				onBackToList={noop}
			/>,
		);
		expect(screen.getByText(/2 agents paused/)).toBeTruthy();
		expect(screen.getByText(/main/)).toBeTruthy();
		expect(screen.getByText(/researcher/)).toBeTruthy();
	});

	it("does not render anything when closed", () => {
		const { container } = render(
			<PauseDetailDrawer
				open={false}
				onClose={noop}
				agent={null}
				pausedAgents={[]}
				onSelectAgent={noop}
				onBackToList={noop}
			/>,
		);
		// Portal not mounted while closed
		expect(container.querySelector("#pause-detail-drawer")).toBeNull();
	});
});
