// Generate the plugin payload from the canonical `.claude` source tree.
//
// The shipped source keeps bare agent names + bare references so the flat-copy
// install (`mewkit init`) keeps working unchanged. This builder produces the
// plugin variant: a transformed copy of `.claude` at the plugin root, with kit
// agent references namespaced to `<plugin>:<agent>` and the one skill dir whose
// name diverges from its slug (`mk-loop`) renamed so the plugin's
// directory-derived slash command resolves to `/mk:loop`.
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { extname, join, relative } from "node:path";
import {
	buildClaudePluginJson,
	buildCodexPluginJson,
	PLUGIN_NAME,
	type PluginIdentity,
} from "./plugin-manifest.js";
import { collectAgentNames, rewriteAgentRefs } from "./plugin-agent-refs.js";
import { buildPluginHooks, readSettingsHooks } from "./plugin-hooks.js";

/** File extensions whose contents are scanned for agent references. */
const TEXT_EXTENSIONS = new Set([
	".md",
	".json",
	".sh",
	".cjs",
	".mjs",
	".js",
	".ts",
	".py",
	".txt",
	".yaml",
	".yml",
]);

/** Top-level `.claude` entries excluded from the plugin payload (runtime state). */
const EXCLUDED_DIRS = new Set(["session-state", "memory", "logs"]);
const EXCLUDED_FILES = new Set(["metadata.json", ".env"]);

export interface GeneratePayloadOptions extends PluginIdentity {
	/** Path to the canonical `.claude` source directory. */
	sourceDir: string;
	/** Path to the plugin root to (re)generate. */
	outDir: string;
	/** Agent names to namespace; defaults to the names found in `sourceDir/agents`. */
	agentNames?: Set<string>;
}

export interface GeneratePayloadResult {
	filesScanned: number;
	refsRewritten: number;
	loopDirRenamed: boolean;
	/** Non-agent `.md` files dropped from `agents/` (e.g. index files). */
	nonAgentsPruned: number;
	/** True when a plugin `hooks/hooks.json` was generated from settings.json. */
	hooksGenerated: boolean;
}

/**
 * Build the plugin payload at `outDir`. Idempotent: clears and regenerates.
 * Returns counts for verification.
 */
export function generatePluginPayload(opts: GeneratePayloadOptions): GeneratePayloadResult {
	const pluginName = opts.name ?? PLUGIN_NAME;
	const agentNames = opts.agentNames ?? collectAgentNames(join(opts.sourceDir, "agents"));

	if (existsSync(opts.outDir)) rmSync(opts.outDir, { recursive: true, force: true });
	mkdirSync(opts.outDir, { recursive: true });

	// Copy every non-excluded top-level entry of the source tree.
	for (const entry of readdirSync(opts.sourceDir)) {
		if (EXCLUDED_DIRS.has(entry) || EXCLUDED_FILES.has(entry)) continue;
		const src = join(opts.sourceDir, entry);
		const dest = join(opts.outDir, entry);
		if (statSync(src).isDirectory() && entry === "skills") {
			copySkills(src, dest);
		} else {
			cpSync(src, dest, { recursive: true });
		}
	}

	// Rename the one skill dir whose name diverges from its slug.
	let loopDirRenamed = false;
	const mkLoop = join(opts.outDir, "skills", "mk-loop");
	if (existsSync(mkLoop)) {
		renameSync(mkLoop, join(opts.outDir, "skills", "loop"));
		loopDirRenamed = true;
	}

	// Drop non-agent `.md` files from `agents/` (index files have no `name:`),
	// so the plugin registry does not register them as agents.
	const nonAgentsPruned = pruneNonAgents(join(opts.outDir, "agents"));

	// Translate flat-copy hook wiring (settings.json) into plugin hooks.json.
	const settingsHooks = readSettingsHooks(join(opts.sourceDir, "settings.json"));
	const hooksGenerated = settingsHooks !== null;
	if (settingsHooks) {
		writeManifest(join(opts.outDir, "hooks", "hooks.json"), buildPluginHooks(settingsHooks));
	}

	// Rewrite kit agent references across every text file in the payload.
	let filesScanned = 0;
	let refsRewritten = 0;
	for (const file of walkFiles(opts.outDir)) {
		if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
		filesScanned += 1;
		const original = readFileSync(file, "utf-8");
		const { content, count } = rewriteAgentRefs(original, agentNames, pluginName);
		if (count > 0) {
			writeFileSync(file, content);
			refsRewritten += count;
		}
	}

	// Write both runtime plugin manifests into the plugin root.
	writeManifest(join(opts.outDir, ".claude-plugin", "plugin.json"), buildClaudePluginJson(opts));
	writeManifest(join(opts.outDir, ".codex-plugin", "plugin.json"), buildCodexPluginJson(opts));

	return { filesScanned, refsRewritten, loopDirRenamed, nonAgentsPruned, hooksGenerated };
}

/** Remove `.md` files in `agents/` that lack a `name:` frontmatter (not agents). */
function pruneNonAgents(agentsDir: string): number {
	if (!existsSync(agentsDir)) return 0;
	let pruned = 0;
	for (const entry of readdirSync(agentsDir)) {
		if (!entry.endsWith(".md")) continue;
		const file = join(agentsDir, entry);
		if (!/^name:/m.test(readFileSync(file, "utf-8"))) {
			unlinkSync(file);
			pruned += 1;
		}
	}
	return pruned;
}

/** Copy the skills tree but drop the bundled Python virtualenv. */
function copySkills(srcSkills: string, destSkills: string): void {
	mkdirSync(destSkills, { recursive: true });
	for (const entry of readdirSync(srcSkills)) {
		if (entry === ".venv") continue;
		cpSync(join(srcSkills, entry), join(destSkills, entry), { recursive: true });
	}
}

/** Yield every file path under a directory, recursively. */
function* walkFiles(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walkFiles(full);
		} else if (entry.isFile()) {
			yield full;
		}
	}
}

/** Deterministic, pretty-printed JSON write with a trailing newline. */
function writeManifest(path: string, value: unknown): void {
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Relative payload paths of the two generated plugin manifests (for callers). */
export function pluginManifestPaths(outDir: string): string[] {
	return [
		relative(process.cwd(), join(outDir, ".claude-plugin", "plugin.json")),
		relative(process.cwd(), join(outDir, ".codex-plugin", "plugin.json")),
	];
}
