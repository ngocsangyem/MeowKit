import fs from "node:fs";
import path from "node:path";
import { CURATED_STORES, type Pattern } from "./schemas.js";

export interface LoadedStore {
	file: string;
	scope: string;
	itemsKey: "patterns" | "findings";
	data: Record<string, unknown>;
	items: Array<Record<string, unknown>>;
}

export function loadStores(memoryDir: string): LoadedStore[] {
	const stores: LoadedStore[] = [];
	for (const spec of CURATED_STORES) {
		const p = path.join(memoryDir, spec.file);
		if (!fs.existsSync(p)) continue;
		const data = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, unknown>;
		const raw = data[spec.itemsKey];
		stores.push({
			file: spec.file,
			scope: spec.scope,
			itemsKey: spec.itemsKey,
			data,
			items: Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [],
		});
	}
	return stores;
}

export function entryId(entry: Record<string, unknown>, fallback: string): string {
	return typeof entry.id === "string" && entry.id.length > 0 ? entry.id : fallback;
}

export function entryTitle(entry: Record<string, unknown>): string {
	for (const key of ["pattern", "finding", "context", "applicable_when", "category", "type"]) {
		const value = entry[key];
		if (typeof value === "string" && value.trim()) return value.trim().slice(0, 120);
	}
	return JSON.stringify(entry).slice(0, 120);
}

export function entryDate(entry: Record<string, unknown>): string | null {
	for (const key of ["lastSeen", "timestamp", "created", "archivedAt"]) {
		const value = entry[key];
		if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return value;
	}
	return null;
}

export function clonePattern(entry: Pattern): Pattern {
	return JSON.parse(JSON.stringify(entry)) as Pattern;
}
