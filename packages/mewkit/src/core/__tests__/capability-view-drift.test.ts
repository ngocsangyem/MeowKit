// Phase 7 slice 2: generated-view drift-check. The registry is the source of truth; a spliced
// region must not become a second editable truth. Absent markers ⇒ not-yet-spliced (never a false
// drift); matching ⇒ in-sync; diverged ⇒ drift.
import { describe, expect, it } from "vitest";
import {
	renderCapabilityView,
	extractGeneratedRegion,
	capabilityViewDrift,
	VIEW_START,
	VIEW_END,
} from "../generate-capability-view.js";
import type { CapabilityEntry } from "../capability.js";

function cap(id: string, intents: string[]): CapabilityEntry {
	return {
		id,
		kind: "skill",
		description: "",
		aliases: [],
		sourcePath: `skills/${id}/SKILL.md`,
		inventoryId: id,
		owner: "lifecycle",
		installedState: "installed",
		intents,
		whenToUse: null,
		invocation: { kind: "skill", id: "invoke-skill" },
		requirements: [],
		contextRequirement: null,
		support: {},
		verification: { kind: "unknown" },
		dependencies: { upstream: [], downstream: [] },
		provenance: { intents: "authored" },
	};
}

const ENTRIES = [cap("mk:cook", ["build this"]), cap("mk:review", ["review this"])];

function docWith(region: string): string {
	return `# Trigger Registry\n\nsome prose\n\n${VIEW_START}\n${region}\n${VIEW_END}\n\nmore prose\n`;
}

describe("extractGeneratedRegion", () => {
	it("returns the trimmed content between markers", () => {
		expect(extractGeneratedRegion(docWith("HELLO"))).toBe("HELLO");
	});

	it("returns null when markers are absent (not yet spliced)", () => {
		expect(extractGeneratedRegion("# doc with no markers")).toBeNull();
	});

	it("returns null when END precedes START (malformed)", () => {
		expect(extractGeneratedRegion(`${VIEW_END} x ${VIEW_START}`)).toBeNull();
	});
});

describe("capabilityViewDrift", () => {
	it("in-sync when the spliced region matches a fresh render", () => {
		const doc = docWith(renderCapabilityView(ENTRIES));
		expect(capabilityViewDrift(doc, ENTRIES)).toBe("in-sync");
	});

	it("drift when the region diverges from the registry", () => {
		const doc = docWith(
			renderCapabilityView(ENTRIES) + "\n| `mk:ghost` | skill | skill:invoke-skill | authored | stale |",
		);
		expect(capabilityViewDrift(doc, ENTRIES)).toBe("drift");
	});

	it("absent-markers (never a false drift) when the doc has no generated region", () => {
		expect(capabilityViewDrift("# manual doc, no markers", ENTRIES)).toBe("absent-markers");
	});
});
