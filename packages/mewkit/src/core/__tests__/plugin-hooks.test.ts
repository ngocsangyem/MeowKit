import { describe, expect, it } from "vitest";
import { buildPluginHooks, rewriteHookCommand } from "../plugin-hooks.js";

describe("rewriteHookCommand", () => {
	it("swaps the flat-copy root for the plugin root, keeping quotes + args", () => {
		expect(rewriteHookCommand('bash "$CLAUDE_PROJECT_DIR/.claude/hooks/gate.sh"')).toBe(
			'bash "${CLAUDE_PLUGIN_ROOT}/hooks/gate.sh"',
		);
		expect(rewriteHookCommand('node "$CLAUDE_PROJECT_DIR/.claude/hooks/dispatch.cjs" SessionStart')).toBe(
			'node "${CLAUDE_PLUGIN_ROOT}/hooks/dispatch.cjs" SessionStart',
		);
	});

	it("leaves unrelated commands untouched", () => {
		expect(rewriteHookCommand("echo hi")).toBe("echo hi");
	});
});

describe("buildPluginHooks", () => {
	it("rewrites every command across events while preserving matchers/timeouts", () => {
		const settingsHooks = {
			SessionStart: [
				{
					hooks: [{ type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/a.sh"', timeout: 5 }],
				},
			],
			PreToolUse: [
				{
					matcher: "Edit|Write",
					hooks: [
						{ type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/gate.sh"', statusMessage: "Gate" },
					],
				},
			],
		};
		const { hooks } = buildPluginHooks(settingsHooks);
		const start = (hooks.SessionStart as any)[0].hooks[0];
		const pre = (hooks.PreToolUse as any)[0];
		expect(start.command).toBe('bash "${CLAUDE_PLUGIN_ROOT}/hooks/a.sh"');
		expect(start.timeout).toBe(5);
		expect(pre.matcher).toBe("Edit|Write");
		expect(pre.hooks[0].command).toBe('bash "${CLAUDE_PLUGIN_ROOT}/hooks/gate.sh"');
		expect(pre.hooks[0].statusMessage).toBe("Gate");
	});

	it("does not mutate the input object", () => {
		const input = {
			Stop: [{ hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/s.cjs"' }] }],
		};
		buildPluginHooks(input);
		expect((input.Stop as any)[0].hooks[0].command).toBe('node "$CLAUDE_PROJECT_DIR/.claude/hooks/s.cjs"');
	});
});
