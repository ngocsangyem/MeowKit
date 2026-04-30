/**
 * Gate 1 (newest plan) + Gate 2 (newest review verdict) readers.
 *
 * YAML uses FAILSAFE_SCHEMA + try/catch per red-team #14 (avoid unsafe types
 * + crash on partial-write).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";

export interface Gate1State {
	name: string;
	status: string;
	approved: boolean;
}

export interface Gate2State {
	name: string;
	verdict: "PASS" | "WARN" | "FAIL";
}

function newestFile(globRoot: string, leaf: string): string | null {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(globRoot, { withFileTypes: true });
	} catch {
		return null;
	}
	let best: { path: string; mtimeMs: number } | null = null;
	for (const e of entries) {
		if (!e.isDirectory()) continue;
		const candidate = path.join(globRoot, e.name, leaf);
		try {
			const stat = fs.statSync(candidate);
			if (!stat.isFile()) continue;
			if (!best || stat.mtimeMs > best.mtimeMs) {
				best = { path: candidate, mtimeMs: stat.mtimeMs };
			}
		} catch {
			/* skip */
		}
	}
	return best?.path ?? null;
}

function newestFileMatching(globRoot: string, suffix: string): string | null {
	let entries: string[];
	try {
		entries = fs.readdirSync(globRoot);
	} catch {
		return null;
	}
	let best: { path: string; mtimeMs: number } | null = null;
	for (const name of entries) {
		if (!name.endsWith(suffix)) continue;
		const full = path.join(globRoot, name);
		try {
			const stat = fs.statSync(full);
			if (!stat.isFile()) continue;
			if (!best || stat.mtimeMs > best.mtimeMs) {
				best = { path: full, mtimeMs: stat.mtimeMs };
			}
		} catch {
			/* skip */
		}
	}
	return best?.path ?? null;
}

export function readGate1State(projectRoot: string): Gate1State | null {
	const planPath = newestFile(path.join(projectRoot, "tasks", "plans"), "plan.md");
	if (!planPath) return null;
	let raw: string;
	try {
		raw = fs.readFileSync(planPath, "utf-8");
	} catch {
		return null;
	}
	const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return null;
	let parsed: unknown;
	try {
		parsed = yaml.load(fmMatch[1], { schema: yaml.FAILSAFE_SCHEMA });
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") return null;
	const obj = parsed as Record<string, unknown>;
	const status = typeof obj.status === "string" ? obj.status : "unknown";
	const planDir = path.basename(path.dirname(planPath));
	const name = typeof obj.title === "string" ? obj.title.slice(0, 60) : planDir;
	return { name, status, approved: status === "approved" || status === "in_progress" };
}

export function readGate2State(projectRoot: string): Gate2State | null {
	const verdictPath = newestFileMatching(
		path.join(projectRoot, "tasks", "reviews"),
		"-verdict.md",
	);
	if (!verdictPath) return null;
	let raw: string;
	try {
		raw = fs.readFileSync(verdictPath, "utf-8");
	} catch {
		return null;
	}
	const m = raw.match(/verdict:\s*(PASS|WARN|FAIL)/i);
	if (!m) return null;
	const verdict = m[1].toUpperCase() as "PASS" | "WARN" | "FAIL";
	const name = path.basename(verdictPath, "-verdict.md");
	return { name, verdict };
}
