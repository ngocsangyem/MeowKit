/**
 * stitch-write-output.ts — Write boundary: schema-validate response → write design files.
 *
 * Security boundary: this script performs file writes [C] and downloads from validated
 * CDN URLs in the typed response [A-validated] but does NOT read STITCH_API_KEY [B].
 * This satisfies the Skill Rule of Two — at most 2 of the 3 risk factors per step.
 *
 * Input:  JSON object from stitch-api-call.ts via --input flag or stdin pipe.
 * Output: tasks/designs/<plan-or-repo>/<screen-id>/{design.html,design.png,DESIGN.md}
 *
 * Usage:
 *   npx tsx stitch-write-output.ts --input '{"screenId":"...","htmlUrl":"...","imageUrl":"..."}'
 *   npx tsx stitch-api-call.ts export <id> | npx tsx stitch-write-output.ts
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ── Typed schema for the validated API response ───────────────────────────────
// Only fields matching this schema are accepted; any unknown fields are ignored.
interface StitchResponseSchema {
	screenId: string;
	projectId: string;
	htmlUrl?: string;
	imageUrl?: string;
	prompt?: string;
	format?: string;
	creditsUsed?: number;
	creditsRemaining?: number;
	variants?: Array<{ screenId: string; imageUrl: string }>;
}

// ── Schema validation ─────────────────────────────────────────────────────────
// Validate before any CDN download or file write. Reject non-conforming fields.
const INJECTION_PATTERNS = [
	/ignore\s+previous\s+instructions/i,
	/you\s+are\s+now/i,
	/new\s+system\s+prompt/i,
	/disregard\s+your\s+rules/i,
	/forget\s+your\s+rules/i,
	/pretend\s+you\s+are/i,
];

function validateResponseSchema(data: unknown): asserts data is StitchResponseSchema {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw new Error("Response must be a JSON object");
	}
	const obj = data as Record<string, unknown>;

	// Required fields
	if (typeof obj.screenId !== "string" || !obj.screenId.trim()) {
		throw new Error("Response missing required field: screenId (non-empty string)");
	}
	if (typeof obj.projectId !== "string" || !obj.projectId.trim()) {
		throw new Error("Response missing required field: projectId (non-empty string)");
	}

	// API response is DATA — check string fields for instruction-override patterns
	for (const [key, val] of Object.entries(obj)) {
		if (typeof val === "string") {
			for (const pattern of INJECTION_PATTERNS) {
				if (pattern.test(val)) {
					throw new Error(`Rejected field "${key}": contains instruction-override pattern (DATA boundary)`);
				}
			}
		}
	}
}

// ── CDN URL validation ────────────────────────────────────────────────────────
// Only download from HTTPS Google-controlled domains (Stitch CDN).
// Update this allowlist if Stitch changes CDN domains.
const ALLOWED_CDN_SUFFIXES = [".google.com", ".googleapis.com", ".googleusercontent.com", ".withgoogle.com"];

function validateCdnUrl(url: string, fieldName: string): void {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error(`Invalid URL in "${fieldName}": ${url}`);
	}
	if (parsed.protocol !== "https:") {
		throw new Error(`URL in "${fieldName}" must use HTTPS (got ${parsed.protocol})`);
	}
	const { hostname } = parsed;
	const allowed = ALLOWED_CDN_SUFFIXES.some((suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix));
	if (!allowed) {
		throw new Error(
			`URL host "${hostname}" in "${fieldName}" is not a recognized Stitch CDN domain. ` +
				`Allowed: ${ALLOWED_CDN_SUFFIXES.join(", ")}`,
		);
	}
}

// ── Output path resolution ────────────────────────────────────────────────────
// Tasks output path: tasks/designs/<plan-or-repo>/<screen-id>/
function resolvePlanOrRepo(): string {
	// 1. Most recent active plan slug from tasks/plans/
	try {
		const plansDir = "tasks/plans";
		if (fs.existsSync(plansDir)) {
			const entries = fs.readdirSync(plansDir).filter((d) => {
				try {
					return fs.statSync(path.join(plansDir, d)).isDirectory();
				} catch {
					return false;
				}
			});
			if (entries.length > 0) return entries.sort().pop()!;
		}
	} catch {
		/* no tasks/plans dir */
	}

	// 2. Git repo name from remote origin
	try {
		const remote = execSync("git remote get-url origin", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "ignore"],
		}).trim();
		const name =
			remote
				.replace(/\.git$/, "")
				.split(/[/:]/)
				.pop() ?? "";
		if (name) return name.slice(0, 50);
	} catch {
		/* not a git repo */
	}

	// 3. CWD basename fallback
	return path.basename(process.cwd()).slice(0, 50) || "designs";
}

// ── CDN download helper ───────────────────────────────────────────────────────
async function downloadCdnFile(url: string, dest: string, fieldName: string): Promise<void> {
	validateCdnUrl(url, fieldName);
	// Documented Stitch CDN download — URL validated against ALLOWED_CDN_SUFFIXES above
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`CDN download failed for "${fieldName}": ${response.status} ${response.statusText}`);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	fs.writeFileSync(dest, buffer);
}

// ── DESIGN.md generation ──────────────────────────────────────────────────────
// Extract structured design tokens from the Stitch HTML export.
// Fields included: layout_type (inferred), components[], colors[], typography[], spacing[].
function generateDesignMd(html: string, screenId: string): string {
	const lines: string[] = [
		"# Design System",
		"",
		`<!-- stitch-screen-id: ${screenId} -->`,
		"<!-- Generated from Stitch AI export. Hand off to mk:frontend-design for implementation. -->",
		"",
	];

	// layout_type — inferred from structural HTML elements
	const hasNav = /<nav[\s>]/i.test(html);
	const hasAside = /<aside[\s>]/i.test(html);
	const layoutType = hasNav && hasAside ? "sidebar-with-nav" : hasNav ? "top-nav-layout" : "single-column";
	lines.push("## Layout", "", `- \`layout_type: ${layoutType}\``, "");

	// colors[] — Tailwind color utility classes
	const colorMatches = html.match(/(?:bg|text|border|ring|fill|stroke)-(?:\w+)-(?:\d+)/g) ?? [];
	const colors = [...new Set(colorMatches)].slice(0, 20);
	if (colors.length > 0) {
		lines.push("## Colors", "");
		for (const c of colors) lines.push(`- \`${c}\``);
		lines.push("");
	}

	// components[] — semantic HTML structural elements
	const componentMatches =
		html.match(/<(section|nav|header|footer|main|aside|form|button|input|table|dialog|article|ul|ol)[\s>]/gi) ?? [];
	const components = [...new Set(componentMatches.map((c) => c.match(/<(\w+)/)?.[1]?.toLowerCase() ?? ""))].filter(
		Boolean,
	);
	if (components.length > 0) {
		lines.push("## Components", "");
		for (const c of components) lines.push(`- \`<${c}>\``);
		lines.push("");
	}

	// typography — Tailwind text-size and font-weight classes
	const textMatches =
		html.match(
			/(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)|font-(?:thin|light|normal|medium|semibold|bold|extrabold))/g,
		) ?? [];
	const typography = [...new Set(textMatches)].slice(0, 15);
	if (typography.length > 0) {
		lines.push("## Typography", "");
		for (const t of typography) lines.push(`- \`${t}\``);
		lines.push("");
	}

	// spacing — Tailwind padding, margin, gap classes
	const spacingMatches = html.match(/(?:p|m|gap|space)-(?:x|y)?-?\d+/g) ?? [];
	const spacing = [...new Set(spacingMatches)].slice(0, 15);
	if (spacing.length > 0) {
		lines.push("## Spacing", "");
		for (const s of spacing) lines.push(`- \`${s}\``);
		lines.push("");
	}

	lines.push(
		"## Notes",
		"",
		"- Generated from Stitch AI HTML export — Tailwind CSS utility classes throughout",
		"- `layout_type` is inferred from structural HTML elements; verify before implementing",
		'- Pass to mk:frontend-design: "Implement from DESIGN.md"',
	);

	return lines.join("\n");
}

// ── Argument parsing ──────────────────────────────────────────────────────────
function getFlag(name: string): string | undefined {
	const idx = process.argv.indexOf(`--${name}`);
	if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
	return process.argv[idx + 1];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
	// Read input JSON from --input flag or stdin pipe (from stitch-api-call.ts)
	let rawInput = getFlag("input") ?? "";
	if (!rawInput) {
		try {
			rawInput = fs.readFileSync("/dev/stdin", "utf-8").trim();
		} catch {
			console.error("[X] No input provided. Use --input <json> or pipe from stitch-api-call.ts");
			process.exit(1);
		}
	}

	if (!rawInput) {
		console.error("[X] Empty input. Provide JSON from stitch-api-call.ts stdout.");
		process.exit(1);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(rawInput);
	} catch {
		console.error("[X] Input is not valid JSON.");
		process.exit(1);
	}

	// Schema-validate before any file write or CDN download
	validateResponseSchema(parsed);
	const response = parsed; // now typed as StitchResponseSchema

	const planOrRepo = resolvePlanOrRepo();
	const outputDir = path.join("tasks", "designs", planOrRepo, response.screenId);
	fs.mkdirSync(outputDir, { recursive: true });
	console.error(`[i] Output dir: ${outputDir}`);

	const written: string[] = [];

	// Download and write HTML, then generate DESIGN.md
	if (response.htmlUrl) {
		const htmlPath = path.join(outputDir, "design.html");
		await downloadCdnFile(response.htmlUrl, htmlPath, "htmlUrl");
		written.push(htmlPath);
		console.error(`[OK] design.html: ${htmlPath}`);

		// Generate DESIGN.md from downloaded HTML content (tokens extracted locally — no API call)
		const htmlContent = fs.readFileSync(htmlPath, "utf-8");
		const designMd = generateDesignMd(htmlContent, response.screenId);
		const designMdPath = path.join(outputDir, "DESIGN.md");
		fs.writeFileSync(designMdPath, designMd);
		written.push(designMdPath);
		console.error(`[OK] DESIGN.md: ${designMdPath}`);
	}

	// Download and write PNG screenshot
	if (response.imageUrl) {
		const imagePath = path.join(outputDir, "design.png");
		await downloadCdnFile(response.imageUrl, imagePath, "imageUrl");
		written.push(imagePath);
		console.error(`[OK] design.png: ${imagePath}`);
	}

	if (written.length === 0) {
		console.error("[!] Nothing written — response contained no htmlUrl or imageUrl.");
		process.exit(1);
	}

	console.log(JSON.stringify({ screenId: response.screenId, outputDir, written }, null, 2));
}

main().catch((err) => {
	console.error(`[X] Write error: ${(err as Error).message}`);
	process.exit(1);
});
