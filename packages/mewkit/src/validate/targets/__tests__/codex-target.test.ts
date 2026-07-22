// Phase 6: mewkit validate --target codex <dir>. A generated Codex project has a real
// post-migration quality gate. These tests hand-build a minimal valid target and mutate it per
// negative case (broken config, secret leak, non-exec wrapper, tool-token skill, claude-code
// runtime, preserved path ref). The migrate-codex-acceptance suite covers the real-migration path.
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { codexTargetProfile } from "../codex-target.js";
import type { CheckResult } from "../../../commands/validate.js";

let dir: string | null = null;
afterEach(() => {
	if (dir) rmSync(dir, { recursive: true, force: true });
	dir = null;
});

/** Write a minimal, VALID Codex target and return its root. */
function makeTarget(): string {
	dir = mkdtempSync(join(tmpdir(), "codex-target-"));
	writeFileSync(join(dir, "AGENTS.md"), "# AGENTS.md\n");
	mkdirSync(join(dir, ".codex", "agents"), { recursive: true });
	mkdirSync(join(dir, ".codex", "hooks"), { recursive: true });
	mkdirSync(join(dir, ".agents", "skills", "demo"), { recursive: true });
	writeFileSync(join(dir, ".codex", "config.toml"), '[agents.demo]\nconfig_file = "agents/demo.toml"\n');
	writeFileSync(join(dir, ".codex", "agents", "demo.toml"), 'description = "demo agent"\n');
	const wrapper = join(dir, ".codex", "hooks", "w.cjs");
	writeFileSync(
		wrapper,
		'#!/usr/bin/env node\nconst SCRUB_RULES = {"PreToolUse":{"deleteFields":[],"allowedPermissionValues":["deny"]}};\nfunction eventSupportsDeny(rules){return rules.allowedPermissionValues.indexOf("deny")!==-1;}\n',
	);
	chmodSync(wrapper, 0o755);
	writeFileSync(
		join(dir, ".codex", "hooks.json"),
		JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ type: "command", command: `bash "${wrapper}"` }] }] } }),
	);
	writeFileSync(
		join(dir, ".agents", "skills", "demo", "SKILL.md"),
		"---\nname: demo\nruntime: portable\n---\n\n# Demo\nPure guidance.\n",
	);
	return dir;
}

const status = (rs: CheckResult[], nameStart: string): string | undefined =>
	rs.find((r) => r.name.startsWith(nameStart))?.status;
const anyFail = (rs: CheckResult[]): boolean => rs.some((r) => r.status === "fail");

describe("codex target validation", () => {
	it("a valid generated target passes every check (no FAIL)", async () => {
		const rs = await codexTargetProfile.check(makeTarget());
		expect(
			anyFail(rs),
			rs
				.filter((r) => r.status === "fail")
				.map((r) => `${r.name}: ${r.detail}`)
				.join("; "),
		).toBe(false);
		expect(status(rs, "Codex config.toml parses")).toBe("pass");
		expect(status(rs, "Codex hook deny contract")).toBe("pass");
		expect(status(rs, "Codex installed skills tool-token clean")).toBe("pass");
	});

	it("broken config.toml → FAIL parses", async () => {
		const d = makeTarget();
		writeFileSync(join(d, ".codex", "config.toml"), "this is = [not valid toml\n");
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex config.toml parses")).toBe("fail");
	});

	it("a secret-like key with a value → FAIL secret-free", async () => {
		const d = makeTarget();
		writeFileSync(join(d, ".codex", "config.toml"), '[env]\nAPI_KEY = "sk-do-not-leak"\n');
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex config.toml secret-free")).toBe("fail");
	});

	it("a non-executable hook wrapper → FAIL executable", async () => {
		const d = makeTarget();
		chmodSync(join(d, ".codex", "hooks", "w.cjs"), 0o644);
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex hook wrappers")).toBe("fail");
	});

	it("a wrapper whose SCRUB_RULES gates no permission event → WARN deny contract (not a tautology)", async () => {
		const d = makeTarget();
		// Same eventSupportsDeny boilerplate as the valid fixture, but SCRUB_RULES declares NO deny.
		// A source-text grep would still match "allowedPermissionValues ... deny" in the helper; the
		// data-driven check must WARN, proving it reads the rules and not the boilerplate.
		writeFileSync(
			join(d, ".codex", "hooks", "w.cjs"),
			'#!/usr/bin/env node\nconst SCRUB_RULES = {"PreToolUse":{"deleteFields":["x"],"allowedPermissionValues":null}};\nfunction eventSupportsDeny(rules){return rules.allowedPermissionValues.indexOf("deny")!==-1;}\n',
		);
		chmodSync(join(d, ".codex", "hooks", "w.cjs"), 0o755);
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex hook deny contract")).toBe("warn");
		expect(anyFail(rs)).toBe(false);
	});

	it("a dangling config_file agent ref → FAIL agent wiring", async () => {
		const d = makeTarget();
		writeFileSync(join(d, ".codex", "config.toml"), '[agents.gone]\nconfig_file = "agents/gone.toml"\n');
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex config.toml agent wiring")).toBe("fail");
	});

	it("an installed skill with a tool token (/mk:) → FAIL tool-token clean", async () => {
		const d = makeTarget();
		writeFileSync(
			join(d, ".agents", "skills", "demo", "SKILL.md"),
			"---\nname: demo\nruntime: portable\n---\n\nRun /mk:cook now.\n",
		);
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex installed skills tool-token clean")).toBe("fail");
	});

	it("an installed runtime: claude-code skill → FAIL runtime-supported (default-deny breach)", async () => {
		const d = makeTarget();
		writeFileSync(
			join(d, ".agents", "skills", "demo", "SKILL.md"),
			"---\nname: demo\nruntime: claude-code\n---\n\nGuidance.\n",
		);
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex installed skills runtime-supported")).toBe("fail");
	});

	it("a preserved .claude/ path ref → WARN (not FAIL) — no-fabricate policy", async () => {
		const d = makeTarget();
		writeFileSync(
			join(d, ".agents", "skills", "demo", "SKILL.md"),
			"---\nname: demo\nruntime: portable\n---\n\nSee .claude/scripts/x.py (out-of-set).\n",
		);
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex installed skills tool-token clean")).toBe("pass"); // path is not a tool token
		expect(status(rs, "Codex installed skills path refs")).toBe("warn");
		expect(anyFail(rs)).toBe(false);
	});

	it("detect() recognizes a codex target and rejects a bare dir", () => {
		const d = makeTarget();
		expect(codexTargetProfile.detect(d)).toBe(true);
		const bare = mkdtempSync(join(tmpdir(), "bare-"));
		expect(codexTargetProfile.detect(bare)).toBe(false);
		rmSync(bare, { recursive: true, force: true });
	});

	it("a clean target passes the legacy-surface checks", async () => {
		const rs = await codexTargetProfile.check(makeTarget());
		expect(status(rs, "Codex no native memory surface")).toBe("pass");
		expect(status(rs, "Codex no legacy prompts surface")).toBe("pass");
	});

	it("a `.codex/memory` surface → FAIL (memory must stay in .meowkit/)", async () => {
		const d = makeTarget();
		mkdirSync(join(d, ".codex", "memory"), { recursive: true });
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex no native memory surface")).toBe("fail");
		expect(anyFail(rs)).toBe(true);
	});

	it("a deprecated `.codex/prompts` surface → FAIL (must be Agent Skills)", async () => {
		const d = makeTarget();
		mkdirSync(join(d, ".codex", "prompts"), { recursive: true });
		const rs = await codexTargetProfile.check(d);
		expect(status(rs, "Codex no legacy prompts surface")).toBe("fail");
		expect(anyFail(rs)).toBe(true);
	});
});
