// The observer toggle keys for one project, read from that project's registry.
//
// Reading them rather than listing them is what keeps `hooks.<name>` honest: an
// observer cannot exist without a toggle, a toggle cannot name a handler that is
// not registered, and adding an observer needs no second edit anywhere.
//
// A project with no registry — a clone that was never installed, or an install
// mid-upgrade — yields an empty list, which makes every `hooks.<name>` key an
// unknown key. That is the correct answer: nothing is registered, so nothing can
// be switched off, and the message says the key is not a config key.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const REGISTRY_REL = join(".claude", "hooks", "handlers.json");

interface RegistryEntry {
	toggleKey?: unknown;
}

/** Kebab-case toggle keys, sorted and deduplicated; `[]` when unreadable. */
export function observerNames(root: string): string[] {
	const file = join(root, REGISTRY_REL);
	if (!existsSync(file)) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return [];
	}
	if (parsed === null || typeof parsed !== "object") return [];
	const handlers = (parsed as { handlers?: unknown }).handlers;
	if (!Array.isArray(handlers)) return [];
	const names = new Set<string>();
	for (const entry of handlers as RegistryEntry[]) {
		if (entry !== null && typeof entry === "object" && typeof entry.toggleKey === "string" && entry.toggleKey !== "") {
			names.add(entry.toggleKey);
		}
	}
	return [...names].sort();
}
