// Integration test: the safety hooks must append a typed event on each block
// while leaving their marker/stream/exit code unchanged. Reuses the single source
// of truth (scaffoldHarnessProject + runConfiguredHook) rather than a parallel
// spawn harness. Also proves the scrub→parse path preserves structured `data`.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { scaffoldHarnessProject, hasHarness } from "../harness-scaffold.js";
import { runConfiguredHook } from "../hook-runner.js";
import { readEvents } from "../event-log.js";

const SRC_ROOT = process.cwd();
const SETTINGS = hasHarness(SRC_ROOT)
	? (JSON.parse(readFileSync(resolve(SRC_ROOT, ".claude", "settings.json"), "utf8")) as Record<string, unknown>)
	: null;

function hasPython3(): boolean {
	try {
		execSync("python3 --version", { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

// POSIX-shell hooks + python writer; skip on Windows or where python3 is absent.
const RUN = process.platform !== "win32" && SETTINGS !== null && hasPython3();
const d = RUN ? describe : describe.skip;

d("hook event emission", () => {
	it("gate-enforcement.sh emits gate.blocked on a no-plan block, marker/exit unchanged", () => {
		const project = scaffoldHarnessProject(SRC_ROOT);
		try {
			project.clearPlans();
			const [result] = runConfiguredHook(SETTINGS!, {
				projectDir: project.dir,
				event: "PreToolUse",
				tool: "Write",
				toolName: "Write",
				toolInput: { file_path: "src/app.ts" },
				only: "gate-enforcement.sh",
			});
			// Marker/stream/exit unchanged.
			expect(result?.status).toBe(2);
			expect(result?.stderr).toContain("@@GATE_BLOCK@@");
			// Event appended.
			const { events } = readEvents(join(project.dir, ".claude"), { types: ["gate.blocked"] });
			expect(events).toHaveLength(1);
			expect(events[0]?.data.gate).toBe("gate1-no-plan");
			expect(events[0]?.data.file).toBe("src/app.ts");
		} finally {
			project.cleanup();
		}
	});

	it("privacy-block.sh emits privacy.blocked on a sensitive read, marker/exit unchanged", () => {
		const project = scaffoldHarnessProject(SRC_ROOT);
		try {
			const [result] = runConfiguredHook(SETTINGS!, {
				projectDir: project.dir,
				event: "PreToolUse",
				tool: "Read",
				toolName: "Read",
				toolInput: { file_path: ".env" },
				only: "privacy-block.sh",
			});
			expect(result?.status).toBe(2);
			expect(result?.stderr).toContain("@@PRIVACY_BLOCK@@");
			const { events } = readEvents(join(project.dir, ".claude"), { types: ["privacy.blocked"] });
			expect(events).toHaveLength(1);
			expect(events[0]?.data.kind).toBe("sensitive-read");
		} finally {
			project.cleanup();
		}
	});

	it("scrub→parse preserves structured data when the file path has quote/regex chars", () => {
		const project = scaffoldHarnessProject(SRC_ROOT);
		try {
			project.clearPlans();
			// Single-quote + regex-trigger chars must survive as structured `data`,
			// not collapse to {raw:"..."} after the scrubber's sed pipeline.
			const trickyPath = "src/O'Br[i]en.ts";
			runConfiguredHook(SETTINGS!, {
				projectDir: project.dir,
				event: "PreToolUse",
				tool: "Write",
				toolName: "Write",
				toolInput: { file_path: trickyPath },
				only: "gate-enforcement.sh",
			});
			const { events } = readEvents(join(project.dir, ".claude"), { types: ["gate.blocked"] });
			expect(events).toHaveLength(1);
			// Structured: gate field present, NOT a {raw} fallback.
			expect(events[0]?.data.gate).toBe("gate1-no-plan");
			expect(events[0]?.data.raw).toBeUndefined();
			expect(events[0]?.data.file).toBe(trickyPath);
		} finally {
			project.cleanup();
		}
	});

	it("does not write any trace event when no block occurs (allow path)", () => {
		const project = scaffoldHarnessProject(SRC_ROOT);
		try {
			project.addPlan({ nested: true });
			runConfiguredHook(SETTINGS!, {
				projectDir: project.dir,
				event: "PreToolUse",
				tool: "Write",
				toolName: "Write",
				toolInput: { file_path: "src/app.ts" },
				only: "gate-enforcement.sh",
			});
			const logPath = join(project.dir, ".claude", "memory", "trace-log.jsonl");
			// Either no log file, or no gate.blocked line.
			if (existsSync(logPath)) {
				const { events } = readEvents(join(project.dir, ".claude"), { types: ["gate.blocked"] });
				expect(events).toHaveLength(0);
			}
		} finally {
			project.cleanup();
		}
	});
});
