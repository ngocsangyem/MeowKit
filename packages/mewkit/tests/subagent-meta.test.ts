import { afterEach, describe, expect, it } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { resolveNameFromMeta, type MetaResolution } from "../src/orchviz/subagent-meta.js";

let tmpDir: string | null = null;

function writeMeta(meta: Record<string, unknown>): string {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-meta-"));
	const jsonlPath = path.join(tmpDir, "session.jsonl");
	fs.writeFileSync(path.join(tmpDir, "session.meta.json"), JSON.stringify(meta));
	return jsonlPath;
}

afterEach(() => {
	if (tmpDir) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
		tmpDir = null;
	}
});

describe("resolveNameFromMeta", () => {
	it("resolves name from .meta.json description", () => {
		const r = resolveNameFromMeta(writeMeta({ agentType: "developer", description: "build the parser core" }), 1);
		expect(r).toMatchObject<MetaResolution>({ name: "build the parser core" });
	});

	it("falls back to subagent-N when meta missing", () => {
		const r = resolveNameFromMeta("/nonexistent/path.jsonl", 7);
		expect(r).toEqual<MetaResolution>({ name: "subagent-7" });
	});

	it("strips ANSI from description (defense in depth)", () => {
		const r = resolveNameFromMeta(writeMeta({ agentType: "researcher", description: "\u001b[31mEVIL\u001b[0m polished name" }), 1);
		expect(r.name).toBe("EVIL polished name");
	});
});
