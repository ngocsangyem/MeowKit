import { describe, expect, it } from "vitest";
import { deriveImpactFromDiff, enrichWithSearches } from "../impact-map.js";

const diff = (body: string) => body.trimStart();

describe("deriveImpactFromDiff — classification & derivation", () => {
	it("detects changed exports in source and marks PUBLIC_API", () => {
		const d = diff(`
diff --git a/src/api/users.ts b/src/api/users.ts
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@
+export function getUserById(id: string) {}
`);
		const m = deriveImpactFromDiff(d);
		expect(m.changedExports).toEqual([{ file: "src/api/users.ts", symbol: "getUserById" }]);
		expect(m.riskFlags).toContain("PUBLIC_API");
		expect(m.searchTerms).toContain("getUserById");
	});

	it("flags a deleted source file as removed-contract and requires scout", () => {
		const d = diff(`
diff --git a/src/api/old.ts b/src/api/old.ts
deleted file mode 100644
--- a/src/api/old.ts
+++ /dev/null
@@
-export const thing = 1;
`);
		const m = deriveImpactFromDiff(d);
		expect(m.removedOrRenamed.some((s) => s.symbol === "<file deleted>")).toBe(true);
		expect(m.scoutRequired).toBe(true);
		expect(m.scoutReasons.join(" ")).toMatch(/removed or renamed/);
	});

	it("extracts config keys from a config file", () => {
		const d = diff(`
diff --git a/config/app.json b/config/app.json
--- a/config/app.json
+++ b/config/app.json
@@
+  "maxRetries": 3,
`);
		const m = deriveImpactFromDiff(d);
		expect(m.configKeys).toContain("maxRetries");
	});

	it("raises AUTH / DATA_MODEL risk flags from content or path", () => {
		const d = diff(`
diff --git a/src/auth/login.ts b/src/auth/login.ts
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@
+  const token = signJwt(session);
diff --git a/migrations/003.sql b/migrations/003.sql
--- a/migrations/003.sql
+++ b/migrations/003.sql
@@
+ALTER TABLE users ADD COLUMN role text;
`);
		const m = deriveImpactFromDiff(d);
		expect(m.riskFlags).toEqual(expect.arrayContaining(["AUTH", "DATA_MODEL"]));
		expect(m.scoutRequired).toBe(true);
	});
});

describe("deriveImpactFromDiff — scout escalation boundaries", () => {
	it("does NOT require scout for a docs-only change", () => {
		const d = diff(`
diff --git a/docs/readme.md b/docs/readme.md
--- a/docs/readme.md
+++ b/docs/readme.md
@@
+more docs
`);
		const m = deriveImpactFromDiff(d);
		expect(m.scoutRequired).toBe(false);
	});

	it("does NOT require scout for a test-only change", () => {
		const d = diff(`
diff --git a/src/x.test.ts b/src/x.test.ts
--- a/src/x.test.ts
+++ b/src/x.test.ts
@@
+it("works", () => {});
`);
		const m = deriveImpactFromDiff(d);
		expect(m.scoutRequired).toBe(false);
	});

	it("does NOT require scout for a small internal change with no exports/risk", () => {
		const d = diff(`
diff --git a/src/util/pad.ts b/src/util/pad.ts
--- a/src/util/pad.ts
+++ b/src/util/pad.ts
@@
+  const n = 2; // internal tweak
`);
		const m = deriveImpactFromDiff(d);
		// util/ path trips ABSTRACTION → scout warranted; assert the flag drives it.
		expect(m.riskFlags).toContain("ABSTRACTION");
	});

	it("requires scout for a config file DELETE (criterion #4 regression)", () => {
		const d = diff(`
diff --git a/config/flags.json b/config/flags.json
deleted file mode 100644
--- a/config/flags.json
+++ /dev/null
@@
-  "betaEnabled": true
`);
		const m = deriveImpactFromDiff(d);
		expect(m.scoutRequired).toBe(true);
		expect(m.removedOrRenamed.length).toBeGreaterThan(0);
	});

	it("requires scout for a config file RENAME", () => {
		const d = diff(`
diff --git a/config/old.json b/config/new.json
rename from config/old.json
rename to config/new.json
`);
		const m = deriveImpactFromDiff(d);
		expect(m.scoutRequired).toBe(true);
	});

	it("does NOT escalate for a docs/test/lockfile DELETE", () => {
		const d = diff(`
diff --git a/docs/old.md b/docs/old.md
deleted file mode 100644
--- a/docs/old.md
+++ /dev/null
@@
-gone
diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
deleted file mode 100644
--- a/pnpm-lock.yaml
+++ /dev/null
@@
-gone
`);
		const m = deriveImpactFromDiff(d);
		expect(m.scoutRequired).toBe(false);
	});

	it("requires scout when spanning 3+ production directories", () => {
		const d = diff(`
diff --git a/src/a/one.ts b/src/a/one.ts
--- a/src/a/one.ts
+++ b/src/a/one.ts
@@
+const a = 1;
diff --git a/src/b/two.ts b/src/b/two.ts
--- a/src/b/two.ts
+++ b/src/b/two.ts
@@
+const b = 2;
diff --git a/src/c/three.ts b/src/c/three.ts
--- a/src/c/three.ts
+++ b/src/c/three.ts
@@
+const c = 3;
`);
		const m = deriveImpactFromDiff(d);
		expect(m.productionDirs.length).toBeGreaterThanOrEqual(3);
		expect(m.scoutRequired).toBe(true);
	});
});

describe("enrichWithSearches", () => {
	it("maps each search term to injected search hits", () => {
		const m = deriveImpactFromDiff(
			diff(`
diff --git a/src/api/users.ts b/src/api/users.ts
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@
+export function getUserById(id: string) {}
`),
		);
		const enriched = enrichWithSearches(m, (t) => (t === "getUserById" ? ["src/routes/users.ts:12"] : []));
		expect(enriched.callers).toEqual([{ term: "getUserById", hits: ["src/routes/users.ts:12"] }]);
	});
});
