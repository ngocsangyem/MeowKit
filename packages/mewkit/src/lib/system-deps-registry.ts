/**
 * system-deps-registry.ts
 *
 * Single source of truth for installable system dependencies.
 *
 * WHY THIS FILE EXISTS (Q4 / locked decision #2):
 * The mewkit CLI used to hardcode ffmpeg + imagemagick directly in setup.ts and
 * doctor.ts. This refactor extracts them into a typed registry so:
 *   1. Skills can declare opt-in system deps via SKILL.md metadata (schema-driven).
 *   2. The CLI iterates the registry instead of hardcoded if/else branches.
 *   3. New deps (e.g. playwright-chromium) are registered here — not scattered.
 *
 * PARSE CONTRACT (optional_system_deps HTML comment):
 * Claude Code's native frontmatter schema does NOT support custom fields like
 * optional_system_deps — they are silently dropped. Skills instead declare deps in
 * a MEOWKIT METADATA HTML comment block inside SKILL.md:
 *
 *   <!--
 *   MEOWKIT METADATA ...:
 *     optional_system_deps: [playwright-chromium]
 *   -->
 *
 * parseOptionalSystemDepsFromSkillMd() finds this comment and extracts the list.
 * validateSkillDeclaredKeys() then checks each key against SYSTEM_DEPS — unknown
 * keys are rejected so no skill can request arbitrary package installs.
 *
 * Playwright version: 1.58.0 (pinned from PyPI on 2026-04-09 via WebFetch).
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DoctorContext {
	/** Absolute path to the project root (contains .claude/) */
	projectRoot: string;
}

export interface DoctorResult {
	status: "OK" | "MISSING_PACKAGE" | "MISSING_BINARY" | "ERROR";
	message?: string;
}

export interface SystemDepEntry {
	/** Registry key — referenced in SKILL.md optional_system_deps */
	key: string;
	/** Human-readable name shown in prompts */
	name: string;
	/**
	 * Shell command whose exit code 0 means the dep is present.
	 * For PATH-based deps with a single binary (e.g. ffmpeg), this is the canonical probe.
	 * When the dep may ship under multiple binary names (e.g. ImageMagick 6 uses "convert",
	 * ImageMagick 7+ uses "magick"), use detectCommands instead.
	 */
	detectCommand: string;
	/**
	 * Optional fallback probes for deps that ship under multiple binary names.
	 * If ANY entry exits 0, the dep is considered present.
	 * When set, takes precedence over detectCommand for presence checks.
	 * Example: ImageMagick 6 ships "convert", IM 7+ ships "magick" (no "convert" shim).
	 */
	detectCommands?: string[];
	/** Per-OS ordered list of install commands */
	installCommands: Partial<Record<NodeJS.Platform, string[]>>;
	/** Link shown to users when auto-install is unavailable */
	manualUrl: string;
	/** Approximate download size in bytes — shown as ~NMB in prompts */
	sizeBytes: number;
	/** Optional dedicated doctor check (overrides generic detectCommand probe) */
	doctorCheck?: (ctx: DoctorContext) => Promise<DoctorResult>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Dedicated Playwright doctor check (locked decision #3):
 * Two probes — package import AND chromium binary presence.
 * Generic detectCommand is not enough here because pip install playwright
 * succeeds without downloading the ~130MB Chromium binary.
 */
async function playwrightDoctorCheck(ctx: DoctorContext): Promise<DoctorResult> {
	const venvPython = path.join(ctx.projectRoot, ".claude", "skills", ".venv", "bin", "python3");
	// On Windows the venv layout differs
	const venvPythonWin = path.join(ctx.projectRoot, ".claude", "skills", ".venv", "Scripts", "python.exe");
	const python = process.platform === "win32" ? venvPythonWin : venvPython;

	// Probe 1: can we import playwright?
	const importProbe = spawnSync(python, ["-c", "import playwright"], {
		encoding: "utf-8",
		stdio: ["pipe", "pipe", "pipe"],
	});
	if (importProbe.status !== 0) {
		return {
			status: "MISSING_PACKAGE",
			message: "playwright Python package not installed — run: npx mewkit setup --system-deps",
		};
	}

	// Probe 2: is the Chromium binary installed?
	// playwright install --dry-run chromium exits 0 and prints "chromium" if installed
	const venvPlaywright =
		process.platform === "win32"
			? path.join(ctx.projectRoot, ".claude", "skills", ".venv", "Scripts", "playwright.exe")
			: path.join(ctx.projectRoot, ".claude", "skills", ".venv", "bin", "playwright");

	const dryRunProbe = spawnSync(venvPlaywright, ["install", "--dry-run", "chromium"], {
		encoding: "utf-8",
		stdio: ["pipe", "pipe", "pipe"],
	});

	// --dry-run output contains "chromium" when already installed (no-op)
	// If it returns non-zero or output doesn't mention chromium, binary is missing
	const combinedOutput = (dryRunProbe.stdout ?? "") + (dryRunProbe.stderr ?? "");
	if (dryRunProbe.status !== 0 || !combinedOutput.toLowerCase().includes("chromium")) {
		return {
			status: "MISSING_BINARY",
			message: "Chromium binary not installed — run: npx mewkit setup --system-deps",
		};
	}

	return { status: "OK" };
}

/**
 * All registered system dependencies.
 * Insertion order = display order in prompts (ffmpeg, imagemagick, playwright-chromium).
 */
export const SYSTEM_DEPS: Record<string, SystemDepEntry> = {
	ffmpeg: {
		key: "ffmpeg",
		name: "FFmpeg",
		detectCommand: "ffmpeg",
		installCommands: {
			darwin: ["brew install ffmpeg"],
			linux: [
				// apt-get
				"apt-get install -y ffmpeg",
				// dnf fallback handled at runtime in setup.ts by checking available pkg manager
			],
			win32: [],
		},
		manualUrl: "https://ffmpeg.org/download.html",
		sizeBytes: 50_000_000,
	},

	imagemagick: {
		key: "imagemagick",
		name: "ImageMagick",
		// IM 6 ships "convert"; IM 7+ ships "magick" with no "convert" shim.
		// detectCommands ensures presence is detected regardless of which version is installed.
		detectCommand: "convert",
		detectCommands: ["convert", "magick"],
		installCommands: {
			darwin: ["brew install imagemagick"],
			linux: ["apt-get install -y imagemagick"],
			win32: [],
		},
		manualUrl: "https://imagemagick.org/script/download.php",
		sizeBytes: 20_000_000,
	},

	// Playwright version: 1.58.0 — pinned from PyPI on 2026-04-09 via WebFetch
	// Source: https://pypi.org/pypi/playwright/json → info.version = "1.58.0"
	"playwright-chromium": {
		key: "playwright-chromium",
		name: "Playwright + Chromium",
		// Detect by importing the Python package (not a PATH command)
		detectCommand: ".claude/skills/.venv/bin/python3 -c 'import playwright'",
		installCommands: {
			darwin: [
				".claude/skills/.venv/bin/pip install playwright==1.58.0",
				".claude/skills/.venv/bin/playwright install chromium",
			],
			linux: [
				".claude/skills/.venv/bin/pip install playwright==1.58.0",
				".claude/skills/.venv/bin/playwright install chromium",
			],
			win32: [
				".claude\\skills\\.venv\\Scripts\\pip install playwright==1.58.0",
				".claude\\skills\\.venv\\Scripts\\playwright install chromium",
			],
		},
		sizeBytes: 200_000_000,
		manualUrl: "https://playwright.dev/python/docs/intro",
		doctorCheck: playwrightDoctorCheck,
	},
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all registered entries in insertion order */
export function listDeps(): SystemDepEntry[] {
	return Object.values(SYSTEM_DEPS);
}

/**
 * Check whether a PATH-based dep's binary (or any of its aliases) is present.
 * Uses detectCommands when set (multi-probe); falls back to single detectCommand probe.
 *
 * NOT suitable for venv-based deps (playwright-chromium) — callers must handle
 * those separately (detectCommand includes ".venv").
 */
export function isDepCommandPresent(dep: SystemDepEntry, commandAvailableFn: (cmd: string) => boolean): boolean {
	const probes = dep.detectCommands ?? [dep.detectCommand];
	return probes.some((cmd) => commandAvailableFn(cmd));
}

/** Look up a single entry by key */
export function getDep(key: string): SystemDepEntry | undefined {
	return SYSTEM_DEPS[key];
}

/**
 * Validate keys declared in a skill's optional_system_deps against the registry.
 * Unknown keys are rejected to prevent skills from requesting arbitrary installs.
 *
 * @param declared  Keys parsed from SKILL.md optional_system_deps comment
 * @param skillName Used in warning messages for traceability
 */
export function validateSkillDeclaredKeys(
	declared: string[],
	skillName: string,
): { valid: string[]; invalid: string[] } {
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const key of declared) {
		if (SYSTEM_DEPS[key]) {
			valid.push(key);
		} else {
			console.warn(
				`[mewkit] Skill "${skillName}" declares unknown system dep "${key}" — ignored. ` +
					`Register it in lib/system-deps-registry.ts to allow installation.`,
			);
			invalid.push(key);
		}
	}

	return { valid, invalid };
}

/**
 * Parse optional_system_deps from a SKILL.md HTML comment block.
 *
 * PARSE CONTRACT:
 * The parser looks for a comment starting with "MEOWKIT METADATA" and extracts
 * the "optional_system_deps:" line from it. Handles both single-line and
 * multi-line YAML-ish list formats:
 *
 *   optional_system_deps: [playwright-chromium]
 *   optional_system_deps: [playwright-chromium, ffmpeg]
 *
 * Multi-line YAML block format (not currently used but handled):
 *   optional_system_deps:
 *     - playwright-chromium
 *
 * Returns an empty array if the comment or field is absent.
 *
 * WHY NOT NATIVE FRONTMATTER (Q4 decision):
 * Claude Code's frontmatter schema only supports a fixed set of native fields.
 * Custom fields like optional_system_deps are silently dropped. The HTML comment
 * approach is the agreed MeowKit convention for skill metadata that the CLI needs
 * but Claude Code should ignore.
 */
export function parseOptionalSystemDepsFromSkillMd(skillMdContent: string): string[] {
	// Find the MEOWKIT METADATA comment block
	const commentMatch = skillMdContent.match(/<!--\s*\n\s*MEOWKIT METADATA[\s\S]*?-->/);
	if (!commentMatch) return [];

	const block = commentMatch[0];

	// Inline bracket format: optional_system_deps: [key1, key2]
	const inlineMatch = block.match(/optional_system_deps:\s*\[([^\]]*)\]/);
	if (inlineMatch) {
		const raw = inlineMatch[1] ?? "";
		return raw
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	// Multi-line YAML block format:
	//   optional_system_deps:
	//     - key1
	//     - key2
	const blockMatch = block.match(/optional_system_deps:\s*\n((?:\s*-\s*\S+\s*\n?)+)/);
	if (blockMatch) {
		const lines = blockMatch[1] ?? "";
		return lines
			.split("\n")
			.map((l) => l.replace(/^\s*-\s*/, "").trim())
			.filter((s) => s.length > 0);
	}

	return [];
}
