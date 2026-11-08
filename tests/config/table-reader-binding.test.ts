// The classification table has to describe the code, not only be described by it.
//
// The read check proves every read is classified. On its own that is half a
// property, and the missing half is the one that failed: the table named two
// handler files as the readers of two environment names those files had stopped
// reading, and recorded five names as "not read anywhere now" while a shipped
// script, a live handler and a CLI module still read them. Nothing bound the
// metadata to the code, so `doctor` told users to unset a name two scripts read
// and the session banner reported the inverse of the effective config — with
// every test passing.
//
// So each row is bound both ways: a live name is read at a file its reader
// column names, and a name recorded as replaced is read nowhere at all.
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const require_ = createRequire(import.meta.url);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TREES = [".claude", join("packages", "mewkit", "src")];

interface Row {
	name: string;
	class: string;
	key: string;
	reader: string;
}
interface Table {
	names: Row[];
	compositionZones: { dir: string; prefix: string }[];
	nonSuffixLiterals: Record<string, string>;
}
interface Read {
	name: string;
	file: string;
	line: number;
	composed?: boolean;
}

const table = require_(join(REPO_ROOT, "env-name-classification.json")) as Table;
const { scanReads } = require_(join(REPO_ROOT, "scripts/lib/env-read-scan.cjs")) as {
	scanReads: (root: string, trees: string[], t: Table) => Read[];
};
const { auditTable, REPLACED_CLASSES } = require_(join(REPO_ROOT, "scripts/lib/env-table-audit.cjs")) as {
	auditTable: (root: string, t: Table, r: Read[]) => { name: string; reason: string }[];
	REPLACED_CLASSES: Set<string>;
};

const reads = (): Read[] => scanReads(REPO_ROOT, TREES, table);

describe("every classified name is bound to what the code does", () => {
	it("a live name is read at the file its reader column names; a replaced one is read nowhere", () => {
		const problems = auditTable(REPO_ROOT, table, reads());
		expect(problems.map((p) => `${p.name}: ${p.reason}`)).toEqual([]);
	});

	// Two positive controls, one per direction, so an empty result above is
	// evidence of agreement rather than of a check that looks at nothing.
	it("catches a reader column pointed at a file that does not read the name", () => {
		const live = table.names.find((r) => !REPLACED_CLASSES.has(r.class) && r.reader.includes(".cjs"));
		expect(live, "no live row names a reader to probe with").toBeDefined();
		const probed = table.names.map((r) => (r === live ? { ...r, reader: "scripts/scan-env-names.sh" } : r));
		expect(auditTable(REPO_ROOT, { ...table, names: probed }, reads()).length).toBeGreaterThan(0);
	});

	it("catches a replaced name that is read again", () => {
		const replaced = table.names.find((r) => REPLACED_CLASSES.has(r.class) && r.key !== "");
		expect(replaced, "no replaced row to probe with").toBeDefined();
		const planted: Read[] = [
			...reads(),
			{ name: (replaced as Row).name, file: join(REPO_ROOT, "scripts/scan-env-names.sh"), line: 1 },
		];
		const problems = auditTable(REPO_ROOT, table, planted);
		expect(problems.map((p) => p.name)).toContain((replaced as Row).name);
	});

	it("requires a reader column that names a file, and a file that exists", () => {
		for (const missing of ["", "read from the environment"]) {
			const live = table.names.find((r) => !REPLACED_CLASSES.has(r.class) && r.reader.includes(".cjs")) as Row;
			const probed = table.names.map((r) => (r.name === live.name ? { ...r, reader: missing } : r));
			expect(auditTable(REPO_ROOT, { ...table, names: probed }, reads()).length, missing).toBeGreaterThan(0);
		}
		const live = table.names.find((r) => !REPLACED_CLASSES.has(r.class) && r.reader.includes(".cjs")) as Row;
		const gone = table.names.map((r) => (r.name === live.name ? { ...r, reader: "hooks/lib/not-a-file.cjs" } : r));
		expect(auditTable(REPO_ROOT, { ...table, names: gone }, reads()).length).toBeGreaterThan(0);
	});
});
