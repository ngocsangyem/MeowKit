// The on-disk manifest for the plugin shape of a Claude Code install.
//
// Two sources, deliberately separated, because they answer different questions
// and only one of them belongs to this codebase:
//
//   WHAT the plugin provides — read from the `claude-plugin` provider
//   declarations already in this tree. Capability levels, bootstrap placement,
//   lifecycle and invocation surface are declared there, consumed here, and
//   restated nowhere. A second table would be two answers to one question, which
//   is the defect the single ship-set source exists to prevent, one layer up.
//
//   WHERE the manifest goes and WHICH fields it may carry — the host's format,
//   retrieved from its current published reference rather than from recall. A
//   field set guessed from memory is a manifest that fails to load for reasons
//   no test here would catch, because the test would encode the same guess.
//
// From that reference: the manifest is `.claude-plugin/plugin.json` under the
// plugin root; `name` is the only required key and must be kebab-case with no
// spaces, `@`, `:` or path separators; every other plugin file sits at the
// plugin root rather than inside `.claude-plugin/`; an unrecognized top-level
// key is stripped with a validator warning, so only declared keys are written;
// `skills` ADDS to the default `skills/` scan while `agents` and `commands`
// REPLACE their default directories; and every component path is relative to the
// plugin root and must start with `./`, must exist, and must resolve inside the
// root.
//
// Because those keys replace rather than extend their defaults, this manifest
// names NO component path at all: the kit lays its content down in exactly the
// standard locations, so declaring them would turn the host's own scan off and
// replace it with a list that has to be kept correct. Metadata only is the
// smaller surface and the one that cannot drift.
import { getProjection } from "../core/provider-projection.js";

/** Directory the host reads the manifest from, relative to the plugin root. */
export const PLUGIN_MANIFEST_DIR = ".claude-plugin";
export const PLUGIN_MANIFEST_FILENAME = "plugin.json";

const PLUGIN_PROVIDER = "claude-plugin";

/** Only keys the host's reference declares. An unknown key is stripped by the host. */
export interface PluginManifest {
	name: string;
	displayName: string;
	version: string;
	description: string;
	license: string;
	keywords: string[];
	homepage: string;
	repository: string;
}

/**
 * Build the manifest for one kit version.
 *
 * `description` is derived from the provider declaration's own evidence string
 * rather than written out again here, so a change to what the plugin claims to
 * support changes what the plugin says about itself in one edit.
 */
export function buildPluginManifest(kitVersion: string): PluginManifest {
	const projection = getProjection(PLUGIN_PROVIDER);
	return {
		name: "meowkit",
		displayName: "MeowKit",
		description: `MeowKit workflow kit for Claude Code. ${projection.evidence}`,
		version: kitVersion,
		license: "MIT",
		keywords: ["workflow", "agents", "skills"],
		homepage: "https://github.com/ngocsangyem/MeowKit",
		repository: "https://github.com/ngocsangyem/MeowKit",
	};
}

/** The bytes written to disk, stable across runs so a re-install is a no-op. */
export const serializePluginManifest = (manifest: PluginManifest): string =>
	`${JSON.stringify(manifest, null, 2)}\n`;
