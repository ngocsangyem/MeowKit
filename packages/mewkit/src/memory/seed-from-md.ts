import fs from "node:fs";
import path from "node:path";

// One-shot MD→JSON seeder. Populates curated JSON stores from their legacy topic
// markdown so JSON-first readers (Phase 2) don't read empty stores = silent
// knowledge loss. Rules: ADDITIVE (only adds entries whose id is new), IDEMPOTENT
// (re-run adds nothing), NEVER overwrites or reorders existing JSON entries.

interface SeedSource {
	file: string; // target JSON
	scope: string;
	consumer: string;
	itemsKey: "patterns" | "findings";
	mdSources: string[]; // topic MD files to read
	category?: string;
}

const SEED_SOURCES: SeedSource[] = [
	{ file: "fixes.json", scope: "fixes", consumer: "mk:fix", itemsKey: "patterns", mdSources: ["fixes.md"], category: "bug-class" },
	{
		file: "review-patterns.json",
		scope: "review-patterns",
		consumer: "mk:review,mk:plan-creator",
		itemsKey: "patterns",
		mdSources: ["review-patterns.md"],
		category: "pattern",
	},
	{
		file: "architecture-decisions.json",
		scope: "architecture-decisions",
		consumer: "mk:plan-creator,mk:cook",
		itemsKey: "patterns",
		mdSources: ["architecture-decisions.md"],
		category: "decision",
	},
	{
		file: "security-findings.json",
		scope: "security-findings",
		consumer: "mk:cso,mk:review",
		itemsKey: "findings",
		mdSources: ["security-log.md", "security-notes.md"],
	},
];

interface MdSection {
	heading: string;
	body: string;
}

// Split a topic MD into `## ` sections (the `# ` title and `> ` intro are skipped).
function parseSections(content: string): MdSection[] {
	const lines = content.split("\n");
	const sections: MdSection[] = [];
	let current: MdSection | null = null;
	for (const line of lines) {
		if (line.startsWith("## ")) {
			if (current) sections.push(current);
			current = { heading: line.slice(3).trim(), body: "" };
		} else if (current) {
			current.body += line + "\n";
		}
	}
	if (current) sections.push(current);
	return sections;
}

function slugify(heading: string): string {
	return heading
		.replace(/\([^)]*\)/g, "") // drop (date, ...) parentheticals
		.replace(/[—–-]\s*\d{4}-\d{2}-\d{2}.*$/, "") // drop "— 2026-05-01" date suffixes
		.replace(/^(plan|decision|note):\s*/i, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60)
		.replace(/-+$/g, "");
}

function deriveId(section: MdSection): string {
	const migrated = section.body.match(/<!--\s*migrated-id:\s*([^\s>]+)\s*-->/);
	if (migrated) return migrated[1];
	const slug = slugify(section.heading);
	return slug || `entry-${section.heading.length}`;
}

function deriveDate(heading: string): string | undefined {
	const iso = heading.match(/(\d{4}-\d{2}-\d{2})/);
	if (iso) return iso[1];
	return undefined;
}

function loadStore(filePath: string, source: SeedSource): Record<string, unknown> {
	if (fs.existsSync(filePath)) {
		try {
			return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
		} catch {
			// fall through to skeleton
		}
	}
	const today = new Date().toISOString().split("T")[0];
	return {
		version: "2.0.0",
		scope: source.scope,
		consumer: source.consumer,
		[source.itemsKey]: [],
		metadata: { created: today, last_updated: today },
	};
}

function atomicWrite(filePath: string, data: unknown): void {
	const tmp = `${filePath}.tmp-${process.pid}`;
	fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
	fs.renameSync(tmp, filePath);
}

export interface SeedResult {
	file: string;
	added: number;
	total: number;
}

export function seedFromMd(memoryDir: string): SeedResult[] {
	const results: SeedResult[] = [];

	for (const source of SEED_SOURCES) {
		const filePath = path.join(memoryDir, source.file);
		const store = loadStore(filePath, source);
		const items = (store[source.itemsKey] as Array<Record<string, unknown>>) ?? [];
		const existingIds = new Set(items.map((it) => String(it.id)));
		let added = 0;

		for (const mdName of source.mdSources) {
			const mdPath = path.join(memoryDir, mdName);
			if (!fs.existsSync(mdPath)) continue;
			const content = fs.readFileSync(mdPath, "utf-8");

			if (source.itemsKey === "findings") {
				// Findings are written as bracketed log lines by injection-audit.py
				// ([DATE] [LEVEL] ...). `## ` headers AND fenced format-doc templates
				// in these files are NOT findings, so both are intentionally skipped.
				let inFence = false;
				for (const line of content.split("\n")) {
					if (line.trim().startsWith("```")) {
						inFence = !inFence;
						continue;
					}
					if (inFence) continue;
					const m = line.match(/^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)$/);
					if (!m) continue;
					const id = `sec-${slugify(m[3]).slice(0, 40)}-${added}`;
					if (existingIds.has(id)) continue;
					items.push({ id, finding: m[3].trim(), severity: m[2].trim(), status: "migrated", source: "seed-from-md" });
					existingIds.add(id);
					added++;
				}
				continue;
			}

			for (const section of parseSections(content)) {
				const id = deriveId(section);
				if (existingIds.has(id)) continue;
				const date = deriveDate(section.heading);
				items.push({
					id,
					category: source.category,
					context: section.body.trim(),
					pattern: section.heading,
					source: "seed-from-md",
					...(date ? { lastSeen: date } : {}),
				});
				existingIds.add(id);
				added++;
			}
		}

		if (added > 0) {
			store[source.itemsKey] = items;
			const meta = (store.metadata as Record<string, unknown>) ?? {};
			meta.last_updated = new Date().toISOString().split("T")[0];
			store.metadata = meta;
			atomicWrite(filePath, store);
		} else if (!fs.existsSync(filePath)) {
			// Ensure a valid skeleton exists even when there was nothing to seed
			// (e.g. security stores with no real findings yet).
			atomicWrite(filePath, store);
		}

		results.push({ file: source.file, added, total: items.length });
	}

	return results;
}
