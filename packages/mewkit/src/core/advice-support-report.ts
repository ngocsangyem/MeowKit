// Per-provider support state for the two `--advice` capabilities.
//
// Embedded supervision and a direct strategy consult are SEPARATE capabilities: a runtime
// can expose one and not the other, and reporting either through the other's state is the
// impersonation the supervision contract exists to prevent. So they are reported
// separately, always, on every provider.
//
// The states form a deliberate ladder — `supported` is the only one that claims a runtime
// was observed doing the thing. Everything below it says, in decreasing order of
// knowledge, "it works but worse", "we have not looked", "it is not there". Structural
// evidence (a file exists, a flag is declared) can never justify `supported`; only a
// recorded live run can. That rule is why this module reads declared state instead of
// inferring it from the presence of the artifacts it names.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AUTHORED_CAPABILITIES } from "./capability-authored.js";
import { resolveCodexModuleDir } from "../migrate/modules/codex-authored-bundle.js";
import { resolveCursorModuleDir } from "../migrate/modules/cursor-authored-bundle.js";

export const ADVICE_SUPPORT_STATES = ["supported", "degraded", "unverified", "unavailable"] as const;
export type AdviceSupportState = (typeof ADVICE_SUPPORT_STATES)[number];

/** The capability id used across the registry, the compliance files and this report. */
export const ADVICE_CAPABILITY_ID = "advice-supervision";

export interface AdviceCapabilityState {
	/** `embedded-supervision` or `direct-consult`. */
	capability: string;
	state: AdviceSupportState;
	/** What the state rests on. `structural` may never carry `supported`. */
	evidence: "structural" | "live";
	detail: string;
	/** What would move it up a rung. */
	blockedBy?: string;
}

export interface AdviceMutationBan {
	/** Whether the runtime can enforce the no-write rule, or only the instructions can. */
	enforcement: "structural" | "behavioral";
	state: AdviceSupportState;
	detail: string;
	blockedBy?: string;
}

export interface AdviceSupportReport {
	provider: string;
	/** Where the declared state came from — an authored bundle, or the capability registry. */
	source: "authored-bundle" | "capability-registry";
	/** Bundle-relative adapter/contract paths, when an authored bundle declares them. */
	adapter: string | null;
	contract: string | null;
	capabilities: AdviceCapabilityState[];
	mutationBan: AdviceMutationBan | null;
}

/** Providers whose declared state lives in an authored bundle's compliance file. */
const BUNDLE_COMPLIANCE: Record<string, () => string> = {
	codex: resolveCodexModuleDir,
	cursor: resolveCursorModuleDir,
};

function isState(value: unknown): value is AdviceSupportState {
	return typeof value === "string" && (ADVICE_SUPPORT_STATES as readonly string[]).includes(value);
}

/**
 * Read a provider's declared `--advice` support.
 *
 * Returns `null` only when the capability itself is absent from the registry — i.e. this
 * build ships no supervision at all. A provider with no evidence still gets a report; that
 * is the point. Silence would read as "fine", and the whole reason these states exist is
 * that an unexercised runtime must say so out loud.
 */
export function readAdviceSupport(providerId: string): AdviceSupportReport | null {
	const entry = AUTHORED_CAPABILITIES.find((c) => c.id === ADVICE_CAPABILITY_ID);
	if (entry === undefined) return null;

	const resolveModuleDir = BUNDLE_COMPLIANCE[providerId];
	if (resolveModuleDir !== undefined) {
		const fromBundle = readBundleState(providerId, resolveModuleDir());
		if (fromBundle !== null) return fromBundle;
	}
	return unverifiedFromRegistry(providerId, entry.support?.[providerId] !== undefined);
}

/** Parse an authored bundle's `adviceSupervision` block. A malformed block is treated as
 *  absent rather than trusted: a support claim read out of a file that does not parse is
 *  worse than no claim, because it looks authoritative. */
function readBundleState(providerId: string, moduleDir: string): AdviceSupportReport | null {
	const path = join(moduleDir, "compliance", "capability-coverage.json");
	if (!existsSync(path)) return null;

	let block: unknown;
	try {
		block = (JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>).adviceSupervision;
	} catch {
		return null;
	}
	if (block === null || typeof block !== "object") return null;
	const b = block as Record<string, unknown>;

	const raw = Array.isArray(b.capabilities) ? b.capabilities : [];
	const capabilities: AdviceCapabilityState[] = [];
	for (const item of raw) {
		if (item === null || typeof item !== "object") continue;
		const c = item as Record<string, unknown>;
		if (typeof c.capability !== "string" || !isState(c.state)) continue;
		capabilities.push({
			capability: c.capability,
			state: c.state,
			evidence: c.evidence === "live" ? "live" : "structural",
			detail: typeof c.detail === "string" ? c.detail : "",
			...(typeof c.blockedBy === "string" ? { blockedBy: c.blockedBy } : {}),
		});
	}
	if (capabilities.length === 0) return null;

	const mb = b.mutationBan;
	let mutationBan: AdviceMutationBan | null = null;
	if (mb !== null && typeof mb === "object") {
		const m = mb as Record<string, unknown>;
		if (isState(m.state)) {
			mutationBan = {
				enforcement: m.enforcement === "structural" ? "structural" : "behavioral",
				state: m.state,
				detail: typeof m.detail === "string" ? m.detail : "",
				...(typeof m.blockedBy === "string" ? { blockedBy: m.blockedBy } : {}),
			};
		}
	}

	return {
		provider: providerId,
		source: "authored-bundle",
		adapter: typeof b.adapter === "string" ? b.adapter : null,
		contract: typeof b.contract === "string" ? b.contract : null,
		capabilities,
		mutationBan,
	};
}

/**
 * The fallback for a provider with no authored-bundle compliance file.
 *
 * The registry's `support` map is populated from recorded evidence only, so an absent
 * provider means "nobody has looked", not "it does not work" — `unverified` either way,
 * because a present-but-unrecorded entry proves nothing about a live run.
 */
function unverifiedFromRegistry(providerId: string, hasRegistryEntry: boolean): AdviceSupportReport {
	const detail = hasRegistryEntry
		? "The capability registry lists this provider, but no recorded live run has exercised it."
		: "No recorded live run and no registry support entry for this provider.";
	const blockedBy = "live provider smoke";
	return {
		provider: providerId,
		source: "capability-registry",
		adapter: null,
		contract: null,
		capabilities: [
			{ capability: "embedded-supervision", state: "unverified", evidence: "structural", detail, blockedBy },
			{ capability: "direct-consult", state: "unverified", evidence: "structural", detail, blockedBy },
		],
		mutationBan: null,
	};
}
