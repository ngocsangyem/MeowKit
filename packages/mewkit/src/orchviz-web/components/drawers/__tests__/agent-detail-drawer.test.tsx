/**
 * AgentDetailDrawer tests — open/close, content, read-only contract.
 *
 * Guarantees:
 *   - Renders nothing when open=false
 *   - Surfaces agent name, state, task, resources
 *   - No control affordances (no buttons matching approve/reject/submit copy)
 *   - Recent tool calls list filters by agent id
 *   - Close × button calls onClose
 */

import React from "react";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AgentDetailDrawer } from "../agent-detail-drawer";
import type { Agent, ToolCallNode } from "@/lib/agent-types";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
	return {
		id: "agent-1",
		name: "planner",
		state: "running" as Agent["state"],
		parentId: null,
		tokensUsed: 12_000,
		tokensMax: 200_000,
		contextBreakdown: {
			systemPrompt: 1000,
			userMessages: 2000,
			toolResults: 5000,
			reasoning: 3000,
			subagentResults: 1000,
		},
		toolCalls: 4,
		timeAlive: 4000,
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		pinned: false,
		isMain: false,
		opacity: 1,
		scale: 1,
		spawnTime: Date.now() - 10000,
		messageBubbles: [
			{ text: "Reading source files…", time: Date.now(), role: "assistant" },
		],
		task: "Investigate token migration coverage",
		runtime: "claude",
		...overrides,
	};
}

function makeToolCall(agentName: string, name: string, id: string): ToolCallNode {
	return {
		id,
		agentId: agentName,
		toolName: name,
		state: "complete",
		args: "src/lib/colors.ts",
		x: 0,
		y: 0,
		startTime: Date.now() - 1000,
		opacity: 1,
	};
}

beforeEach(() => cleanup());
afterEach(() => cleanup());

describe("AgentDetailDrawer", () => {
	const noop = () => undefined;

	it("renders nothing when open=false", () => {
		const agent = makeAgent();
		const { container } = render(
			<AgentDetailDrawer open={false} onClose={noop} agent={agent} toolCalls={new Map()} />,
		);
		// PauseDrawerPortal returns null while !mounted — body should be empty.
		expect(container.querySelector('[id="agent-detail-drawer"]')).toBeNull();
	});

	it("surfaces agent name and runtime/role line", () => {
		const agent = makeAgent({ name: "reviewer", isMain: false, runtime: "claude" });
		render(
			<AgentDetailDrawer open={true} onClose={noop} agent={agent} toolCalls={new Map()} />,
		);
		expect(screen.getByText("reviewer")).toBeTruthy();
		expect(screen.getByText(/claude · subagent/i)).toBeTruthy();
	});

	it("renders task block with agent.task", () => {
		const agent = makeAgent({ task: "Fix token drift" });
		render(
			<AgentDetailDrawer open={true} onClose={noop} agent={agent} toolCalls={new Map()} />,
		);
		expect(screen.getByText("Fix token drift")).toBeTruthy();
	});

	it("filters tool calls by agent id", () => {
		const agent = makeAgent({ name: "planner" });
		const map = new Map<string, ToolCallNode>([
			["a", makeToolCall("planner", "Read", "a")],
			["b", makeToolCall("other", "Bash", "b")],
		]);
		render(
			<AgentDetailDrawer open={true} onClose={noop} agent={agent} toolCalls={map} />,
		);
		expect(screen.getByText("Read")).toBeTruthy();
		expect(screen.queryByText("Bash")).toBeNull();
	});

	it("calls onClose when × button clicked", () => {
		const agent = makeAgent();
		const onClose = vi.fn();
		render(
			<AgentDetailDrawer open={true} onClose={onClose} agent={agent} toolCalls={new Map()} />,
		);
		const closeBtn = screen.getByLabelText("Close drawer");
		fireEvent.click(closeBtn);
		expect(onClose).toHaveBeenCalled();
	});

	it("has no approve/reject/submit affordances (read-only)", () => {
		const agent = makeAgent();
		render(
			<AgentDetailDrawer open={true} onClose={noop} agent={agent} toolCalls={new Map()} />,
		);
		expect(screen.queryByRole("button", { name: /approve|reject|submit/i })).toBeNull();
	});
});
