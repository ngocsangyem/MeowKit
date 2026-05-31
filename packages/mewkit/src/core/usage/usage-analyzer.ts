import type { EventRecord } from "../event-log.js";
import type { InventoryEntry } from "../build-inventory.js";

export type UsageStatus = "available" | "na";

export interface ArtifactUsage {
	id: string;
	type: string;
	count: number;
	lastSeen?: string;
	status: UsageStatus;
}

export interface UsageReport {
	status: UsageStatus;
	reason?: string;
	artifacts: ArtifactUsage[];
}

function eventArtifactId(event: EventRecord): string | null {
	if (event.event === "skill.invoked" && typeof event.data.skill === "string") return event.data.skill;
	if (event.event === "agent.invoked" && typeof event.data.agent === "string") return event.data.agent;
	return null;
}

export function analyzeArtifactUsage(entries: InventoryEntry[], events: EventRecord[]): UsageReport {
	const usageEvents = events.filter((e) => eventArtifactId(e) !== null);
	if (usageEvents.length === 0) {
		return {
			status: "na",
			reason: "Usage events are not emitted yet; pruning cannot honestly classify artifacts as unused.",
			artifacts: entries.map((e) => ({ id: e.id, type: e.type, count: 0, status: "na" })),
		};
	}

	const counts = new Map<string, { count: number; lastSeen?: string }>();
	for (const event of usageEvents) {
		const id = eventArtifactId(event);
		if (!id) continue;
		const row = counts.get(id) ?? { count: 0 };
		row.count++;
		if (!row.lastSeen || event.ts > row.lastSeen) row.lastSeen = event.ts;
		counts.set(id, row);
	}

	return {
		status: "available",
		artifacts: entries.map((entry) => {
			const row = counts.get(entry.id);
			return { id: entry.id, type: entry.type, count: row?.count ?? 0, lastSeen: row?.lastSeen, status: "available" };
		}),
	};
}

export function filterUnused(report: UsageReport, threshold = 1): ArtifactUsage[] {
	if (report.status !== "available") return [];
	return report.artifacts.filter((a) => a.count < threshold);
}
