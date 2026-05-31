import type { EventRecord } from "../event-log.js";

export interface ReviewFailureCluster {
	key: string;
	count: number;
	tasks: string[];
	slug: string;
	dimension?: string;
}

function str(value: unknown, fallback = "unknown"): string {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function clusterKey(event: EventRecord): { key: string; slug: string; dimension?: string } {
	const slug = str(event.data.slug);
	const dimension = str(event.data.dimension ?? event.data.rubric, "");
	return {
		key: dimension ? `${slug}:${dimension}` : slug,
		slug,
		dimension: dimension || undefined,
	};
}

export function clusterReviewFailures(events: EventRecord[], minCount = 2): ReviewFailureCluster[] {
	const clusters = new Map<string, ReviewFailureCluster>();
	for (const event of events) {
		if (event.event !== "verdict_written") continue;
		if (str(event.data.overall).toUpperCase() !== "FAIL") continue;
		const { key, slug, dimension } = clusterKey(event);
		const existing = clusters.get(key) ?? { key, count: 0, tasks: [], slug, dimension };
		existing.count++;
		const task = str(event.data.task, "");
		if (task && !existing.tasks.includes(task)) existing.tasks.push(task);
		clusters.set(key, existing);
	}
	return [...clusters.values()].filter((c) => c.count >= minCount).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
