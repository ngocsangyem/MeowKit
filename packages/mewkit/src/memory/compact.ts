import fs from "node:fs";
import path from "node:path";
import { renderViews } from "./render-views.js";
import { loadStores } from "./store-utils.js";

export interface CompactResult {
	file: string;
	removed: number;
	wrote: boolean;
}

function atomicWrite(file: string, data: string): void {
	const tmp = `${file}.tmp`;
	fs.writeFileSync(tmp, data, "utf-8");
	fs.renameSync(tmp, file);
}

export function compactMemory(memoryDir: string, opts: { dryRun?: boolean } = {}): CompactResult[] {
	const results: CompactResult[] = [];
	for (const store of loadStores(memoryDir)) {
		const seen = new Set<string>();
		const compacted: Array<Record<string, unknown>> = [];
		for (const item of store.items) {
			const key = JSON.stringify(item);
			if (seen.has(key)) continue;
			seen.add(key);
			compacted.push(item);
		}
		const removed = store.items.length - compacted.length;
		if (removed > 0 && !opts.dryRun) {
			store.data[store.itemsKey] = compacted;
			atomicWrite(path.join(memoryDir, store.file), `${JSON.stringify(store.data, null, 2)}\n`);
		}
		results.push({ file: store.file, removed, wrote: removed > 0 && !opts.dryRun });
	}
	if (!opts.dryRun) renderViews(memoryDir, { check: false });
	return results;
}
