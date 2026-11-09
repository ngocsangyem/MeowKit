// Laying down the plugin shape of a Claude Code install.
//
// Same content, same emitter, different envelope. The kit's skills, agents,
// commands and hooks are written by the one install path for both deliveries;
// the plugin delivery adds exactly one file, the manifest, because the host
// discovers every component from its standard locations and the kit already
// writes them there. A parallel writer for the plugin would be a second
// definition of what the kit ships, and the two would drift.
//
// What this does NOT do: publish to a marketplace, stage a payload into a
// release, or implement a separate build verb. The plugin shape is produced by
// the install, which is why there is nothing to build ahead of time.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { buildPluginManifest, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILENAME, serializePluginManifest } from "./plugin-manifest.js";
import { atomicWrite, validateWritableTargetPath } from "../migrate/portable-installer-path-safety.js";

/** Where the manifest goes for a project root. */
export const pluginManifestPath = (root: string): string =>
	join(root, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILENAME);

/**
 * Write the plugin manifest for an installed kit.
 *
 * The destination goes through the shared path-safety helper for the same reason
 * the archive members do: the project root is wherever the user ran the command,
 * and a symlinked `.claude-plugin` would otherwise place the manifest somewhere
 * they cannot see.
 */
export async function emitPluginDelivery(root: string, kitVersion: string): Promise<string> {
	const target = pluginManifestPath(root);
	const unsafe = await validateWritableTargetPath(target, { global: false, boundary: root });
	if (unsafe !== null) {
		throw new Error(
			`The plugin manifest could not be written: ${PLUGIN_MANIFEST_DIR}/ in this project is not a safe destination. Nothing was written.`,
		);
	}
	await atomicWrite(target, serializePluginManifest(buildPluginManifest(kitVersion)));
	return target;
}

/** Whether this project already carries a plugin-shaped install. */
export const hasPluginDelivery = (root: string): boolean => existsSync(pluginManifestPath(root));
