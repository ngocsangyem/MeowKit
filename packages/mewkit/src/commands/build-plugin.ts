// `mewkit build-plugin` — generate the native plugin distribution from `.claude`.
//
// Produces, at the repo root:
//   plugin/                          the transformed plugin payload (tracked)
//   .claude-plugin/marketplace.json  Claude Code marketplace (source: ./plugin)
//   .agents/plugins/marketplace.json Codex marketplace (source: ./plugin)
// The flat-copy source under `.claude/` is never modified — this is a generated
// variant that namespaces agent refs, renames the one divergent skill dir, and
// translates hook wiring for plugin roots.
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { generatePluginPayload } from "../core/plugin-payload.js";
import { buildClaudeMarketplaceJson, buildCodexMarketplaceJson } from "../core/plugin-manifest.js";

export const DESCRIPTION = "MeowKit — an opinionated Claude Code harness (skills, agents, hooks).";
const OWNER = { name: "ngocsangyem" };
export const AUTHOR = { name: "ngocsangyem", email: "nnsang24@gmail.com" };
const MARKETPLACE_NAME = "meowkit";
export const PAYLOAD_DIRNAME = "plugin";

export interface BuildPluginOptions {
	/** Repo root; defaults to the current working directory. */
	root?: string;
	/** Print machine-readable JSON result instead of a human summary. */
	json?: boolean;
}

export async function buildPlugin(opts: BuildPluginOptions = {}): Promise<void> {
	const root = opts.root ?? process.cwd();
	const sourceDir = path.join(root, ".claude");
	if (!fs.existsSync(sourceDir)) {
		console.error(pc.red(`build-plugin: no .claude/ directory at ${root}`));
		process.exitCode = 1;
		return;
	}
	const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8")) as {
		version: string;
	};
	const identity = { version: pkg.version, description: DESCRIPTION, author: AUTHOR };

	const outDir = path.join(root, PAYLOAD_DIRNAME);
	const result = generatePluginPayload({ ...identity, sourceDir, outDir });

	const source = `./${PAYLOAD_DIRNAME}`;
	writeJson(
		path.join(root, ".claude-plugin", "marketplace.json"),
		buildClaudeMarketplaceJson({ ...identity, marketplaceName: MARKETPLACE_NAME, owner: OWNER, source }),
	);
	writeJson(
		path.join(root, ".agents", "plugins", "marketplace.json"),
		buildCodexMarketplaceJson({ marketplaceName: MARKETPLACE_NAME, sourcePath: source }),
	);

	if (opts.json) {
		console.log(JSON.stringify({ version: pkg.version, outDir, ...result }, null, 2));
		return;
	}
	console.log(pc.green(`✔ Built plugin payload v${pkg.version} → ${PAYLOAD_DIRNAME}/`));
	console.log(
		pc.dim(
			`  refs namespaced: ${result.refsRewritten} · hooks: ${
				result.hooksGenerated ? "generated" : "none"
			} · mk-loop renamed: ${result.loopDirRenamed} · non-agents pruned: ${result.nonAgentsPruned}`,
		),
	);
	console.log(pc.dim("  marketplaces: .claude-plugin/marketplace.json, .agents/plugins/marketplace.json"));
}

/** Pretty-printed JSON write with parent dirs and a trailing newline. */
function writeJson(filePath: string, value: unknown): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
