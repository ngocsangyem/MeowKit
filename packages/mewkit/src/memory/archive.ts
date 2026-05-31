import fs from "node:fs";
import path from "node:path";
import { renderViews } from "./render-views.js";
import { entryDate, loadStores } from "./store-utils.js";

export interface ArchiveResult {
	file: string;
	archived: number;
	wrote: boolean;
}

function cutoffMs(days: number): number {
	return Date.now() - days * 86_400_000;
}

function atomicWrite(file: string, data: string): void {
	const tmp = `${file}.tmp`;
	fs.writeFileSync(tmp, data, "utf-8");
	fs.renameSync(tmp, file);
}

export function archiveMemory(memoryDir: string, olderThanDays: number, opts: { dryRun?: boolean } = {}): ArchiveResult[] {
	const cutoff = cutoffMs(olderThanDays);
	const archiveDir = path.join(memoryDir, "archive");
	const results: ArchiveResult[] = [];
	for (const store of loadStores(memoryDir)) {
		const keep: Array<Record<string, unknown>> = [];
		const archive: Array<Record<string, unknown>> = [];
		for (const item of store.items) {
			const date = entryDate(item);
			if (date && Date.parse(date) < cutoff) archive.push({ ...item, archivedAt: new Date().toISOString() });
			else keep.push(item);
		}
		if (archive.length > 0 && !opts.dryRun) {
			fs.mkdirSync(archiveDir, { recursive: true });
			store.data[store.itemsKey] = keep;
			atomicWrite(path.join(memoryDir, store.file), `${JSON.stringify(store.data, null, 2)}\n`);
			const archivePath = path.join(archiveDir, store.file);
			const prior = fs.existsSync(archivePath) ? JSON.parse(fs.readFileSync(archivePath, "utf-8")) as Record<string, unknown> : { archived: [] };
			const archived = Array.isArray(prior.archived) ? prior.archived : [];
			atomicWrite(archivePath, `${JSON.stringify({ ...prior, archived: [...archived, ...archive] }, null, 2)}\n`);
		}
		results.push({ file: store.file, archived: archive.length, wrote: archive.length > 0 && !opts.dryRun });
	}
	if (!opts.dryRun) renderViews(memoryDir, { check: false });
	return results;
}
