import { entryId, entryTitle, loadStores } from "./store-utils.js";

export interface MemoryConflict {
	store: string;
	key: string;
	ids: string[];
	reason: string;
}

export function findMemoryConflicts(memoryDir: string): MemoryConflict[] {
	const conflicts: MemoryConflict[] = [];
	for (const store of loadStores(memoryDir)) {
		const byTitle = new Map<string, Array<Record<string, unknown>>>();
		store.items.forEach((entry, i) => {
			const title = entryTitle(entry).toLowerCase();
			const bucket = byTitle.get(title) ?? [];
			bucket.push({ ...entry, __fallback: `${store.file}:${i}` });
			byTitle.set(title, bucket);
		});
		for (const [key, entries] of byTitle) {
			if (entries.length < 2) continue;
			const rendered = new Set(entries.map((e) => JSON.stringify(e)));
			if (rendered.size > 1) {
				conflicts.push({
					store: store.file,
					key,
					ids: entries.map((e, i) => entryId(e, `${store.file}:${i}`)),
					reason: "same title/context appears with different entry bodies",
				});
			}
		}
	}
	return conflicts;
}
