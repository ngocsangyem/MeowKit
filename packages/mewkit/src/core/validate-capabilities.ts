// Validate a capability manifest against the design invariants (Phase 2 §1/§5). Pure over
// the built manifest + inventory, so it is testable without a live install. Severity:
// ERROR = a broken contract (cross-ref, containment, uniqueness, unknown invocation ID,
// dependency cycle); WARN = a coverage/authoring smell (uncovered artifact, duplicate
// intent across capabilities). No check ever executes a script or trusts a command string.
import { buildCapabilities } from "./build-capabilities.js";
import { buildInventory, type InventoryEntry } from "./build-inventory.js";
import { AUTHORED_INTENTS } from "./capability-authored.js";
import { KNOWN_INVOCATION_IDS, type CapabilityEntry } from "./capability.js";

export interface CapabilityIssue {
	level: "error" | "warn";
	capabilityId: string | null;
	message: string;
}

/** True when `rel` is a `.claude/`-relative path with no escape (no `..`, not absolute). */
function isContained(rel: string): boolean {
	if (rel.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rel)) return false;
	return !rel.split(/[\\/]/).includes("..");
}

/** Detect a cycle in the upstream-dependency graph (DFS with a recursion stack). */
function findCycle(entries: CapabilityEntry[]): string[] | null {
	const upstream = new Map(entries.map((e) => [e.id, e.dependencies.upstream]));
	const state = new Map<string, "visiting" | "done">();
	const stack: string[] = [];

	const visit = (id: string): string[] | null => {
		if (state.get(id) === "done") return null;
		if (state.get(id) === "visiting") return [...stack.slice(stack.indexOf(id)), id];
		state.set(id, "visiting");
		stack.push(id);
		for (const dep of upstream.get(id) ?? []) {
			if (!upstream.has(dep)) continue; // dangling deps are reported by the coverage pass below
			const cycle = visit(dep);
			if (cycle) return cycle;
		}
		stack.pop();
		state.set(id, "done");
		return null;
	};

	for (const e of entries) {
		const cycle = visit(e.id);
		if (cycle) return cycle;
	}
	return null;
}

/** Validate the manifest built from `claudeDir`. Returns all issues (empty ⇒ clean). */
export function validateCapabilities(claudeDir: string): CapabilityIssue[] {
	return validateCapabilityEntries(buildCapabilities(claudeDir), buildInventory(claudeDir).entries);
}

/** Pure validation over a built manifest + inventory. Injectable for testing. */
export function validateCapabilityEntries(entries: CapabilityEntry[], inventoryEntries: InventoryEntry[]): CapabilityIssue[] {
	const issues: CapabilityIssue[] = [];

	const invById = new Map(inventoryEntries.map((e) => [e.id, e]));
	const capIds = new Set<string>();
	const aliasOwners = new Map<string, string>();
	const intentOwners = new Map<string, string[]>();

	for (const c of entries) {
		// id uniqueness
		if (capIds.has(c.id)) issues.push({ level: "error", capabilityId: c.id, message: "duplicate capability id" });
		capIds.add(c.id);

		// path containment (disk-backed kinds only)
		if (c.sourcePath !== null && !isContained(c.sourcePath)) {
			issues.push({ level: "error", capabilityId: c.id, message: `sourcePath escapes .claude/: ${c.sourcePath}` });
		}

		// inventory cross-reference + owner agreement (disk-backed kinds only)
		if (c.inventoryId !== null && c.sourcePath !== null) {
			const inv = invById.get(c.inventoryId);
			if (!inv) {
				issues.push({ level: "error", capabilityId: c.id, message: `inventoryId has no matching inventory entry: ${c.inventoryId}` });
			} else if (inv.owner && c.owner && inv.owner !== c.owner) {
				issues.push({ level: "error", capabilityId: c.id, message: `denormalized owner "${c.owner}" disagrees with inventory "${inv.owner}"` });
			}
		}

		// invocation id must be a known logical id — hostile frontmatter cannot smuggle a command
		if (!KNOWN_INVOCATION_IDS.has(c.invocation.id)) {
			issues.push({ level: "error", capabilityId: c.id, message: `unknown invocation id: ${c.invocation.id}` });
		}

		// alias uniqueness across entries
		for (const a of c.aliases) {
			const prior = aliasOwners.get(a);
			if (prior && prior !== c.id) issues.push({ level: "error", capabilityId: c.id, message: `alias "${a}" also on ${prior}` });
			aliasOwners.set(a, c.id);
		}

		// intent duplication tracking (WARN — inferred keywords can legitimately overlap)
		for (const i of c.intents) {
			intentOwners.set(i, [...(intentOwners.get(i) ?? []), c.id]);
		}
	}

	for (const [intent, owners] of intentOwners) {
		if (owners.length > 1) {
			issues.push({ level: "warn", capabilityId: null, message: `intent "${intent}" maps to multiple capabilities: ${owners.join(", ")}` });
		}
	}

	// Dangling upstream dependency: an upstream id with no matching capability (WARN —
	// a coherence smell, not a hard break, in this pre-resolver slice).
	for (const c of entries) {
		for (const dep of c.dependencies.upstream) {
			if (!capIds.has(dep)) {
				issues.push({ level: "warn", capabilityId: c.id, message: `upstream dependency has no matching capability: ${dep}` });
			}
		}
	}

	// coverage: every enumerated invocable-kind artifact should have a capability (WARN)
	const capInventoryIds = new Set(entries.map((e) => e.inventoryId).filter((x): x is string => x !== null));
	for (const inv of inventoryEntries) {
		if (inv.type === "rule") continue; // rules are inventory-only context, not capabilities
		if (!capInventoryIds.has(inv.id)) {
			issues.push({ level: "warn", capabilityId: null, message: `inventory artifact has no capability: ${inv.path}` });
		}
	}

	// dependency cycle (ERROR)
	const cycle = findCycle(entries);
	if (cycle) issues.push({ level: "error", capabilityId: null, message: `dependency cycle: ${cycle.join(" → ")}` });

	// Authored-intent overlay key with no matching capability (WARN): expected on a partial
	// consumer install that omits a flagship skill, but on a full authoring install it means
	// a dead key (e.g. after a skill rename) silently dropping curated intents. The hard guard
	// against a rename is the resolver test asserting every authored phrase resolves to its owner.
	for (const key of Object.keys(AUTHORED_INTENTS)) {
		if (!capIds.has(key)) {
			issues.push({ level: "warn", capabilityId: key, message: `AUTHORED_INTENTS key has no matching capability (partial install or renamed skill): ${key}` });
		}
	}

	return issues;
}
