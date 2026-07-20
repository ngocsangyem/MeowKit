import { describe, expect, it } from "vitest";
import { resolveAnchor } from "../anchors.js";

const DIFF = `diff --git a/src/api/users.ts b/src/api/users.ts
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -10,3 +10,6 @@
 context line
+export function getUserById(id) {
+  return db.find(id);
+}
 trailing context
diff --git a/src/api/dup.ts b/src/api/dup.ts
--- a/src/api/dup.ts
+++ b/src/api/dup.ts
@@ -1,0 +1,2 @@
+  const x = 1;
+  const x = 1;
`;

describe("resolveAnchor", () => {
	it("resolves an exact snippet to its new-file line number", () => {
		const r = resolveAnchor(DIFF, "src/api/users.ts", "return db.find(id);");
		expect(r).toEqual({ ok: true, anchor: { file: "src/api/users.ts", line: 12, snippet: "return db.find(id);" } });
	});

	it("resolves the first added line's number correctly", () => {
		const r = resolveAnchor(DIFF, "src/api/users.ts", "export function getUserById(id) {");
		expect(r.ok && r.anchor.line).toBe(11);
	});

	it("resolves a whitespace-shifted snippet (normalized match)", () => {
		const r = resolveAnchor(DIFF, "src/api/users.ts", "return   db.find(id);");
		expect(r.ok && r.anchor.line).toBe(12);
	});

	it("rejects an ambiguous snippet that matches multiple added lines", () => {
		const r = resolveAnchor(DIFF, "src/api/dup.ts", "const x = 1;");
		expect(r).toEqual({ ok: false, reason: "ambiguous" });
	});

	it("rejects a snippet that is not in the diff (post-head-change / relocation guard)", () => {
		const r = resolveAnchor(DIFF, "src/api/users.ts", "this code does not exist");
		expect(r).toEqual({ ok: false, reason: "not-found" });
	});

	it("does not match against a different file's added lines", () => {
		const r = resolveAnchor(DIFF, "src/api/other.ts", "return db.find(id);");
		expect(r).toEqual({ ok: false, reason: "not-found" });
	});
});
