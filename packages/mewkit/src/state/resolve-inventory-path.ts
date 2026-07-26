// Where the harness inventory lives. Canonical is `.meowkit/harness-inventory.json`.
//
// The file is a generated registry of `.claude/` artifacts, so it describes one tree while
// living in another. That reads oddly and is stated here on purpose: it is generated rather
// than shipped, which is what makes it state rather than payload.
//
// The split this move closes was real and silent. `validate --substrate` already read the
// canonical path while `build-inventory` and the wiki adapter wrote the pre-move one, so the
// criticality lookup had been quietly resolving to an empty map.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const INVENTORY_BASENAME = "harness-inventory.json";
export const LEGACY_INVENTORY_REL = join(".claude", INVENTORY_BASENAME);

/** Canonical write target: `<root>/.meowkit/harness-inventory.json`. */
export function inventoryWritePath(projectRoot: string): string {
	return join(projectRoot, ".meowkit", INVENTORY_BASENAME);
}

/** The inventory a reader should use: canonical when present, else pre-move, else canonical. */
export function resolveInventoryPath(projectRoot: string): string {
	const canonical = inventoryWritePath(projectRoot);
	if (existsSync(canonical)) return canonical;
	const legacy = join(projectRoot, LEGACY_INVENTORY_REL);
	if (existsSync(legacy)) return legacy;
	return canonical;
}
