import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { readNewFileLines } from "../src/orchviz/fs-utils.js";

let tmpDir: string;
let file: string;

beforeEach(() => {
	tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchviz-"));
	file = path.join(tmpDir, "sample.jsonl");
});

afterEach(() => {
	try {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	} catch {
		/* ignore */
	}
});

describe("readNewFileLines", () => {
	it("returns null when file is missing", () => {
		expect(readNewFileLines(path.join(tmpDir, "nope.jsonl"), 0)).toBeNull();
	});

	it("returns lines from initial read", () => {
		fs.writeFileSync(file, "a\nb\nc\n");
		const r = readNewFileLines(file, 0);
		expect(r).not.toBeNull();
		expect(r!.lines).toEqual(["a", "b", "c"]);
		expect(r!.tail).toBe("");
	});

	it("advances cursor on append", () => {
		fs.writeFileSync(file, "a\nb\n");
		const r1 = readNewFileLines(file, 0);
		fs.appendFileSync(file, "c\n");
		const r2 = readNewFileLines(file, r1!.newSize);
		expect(r2!.lines).toEqual(["c"]);
	});

	it("resets to size 0 on truncation", () => {
		fs.writeFileSync(file, "old content here\n");
		const r1 = readNewFileLines(file, 0);
		fs.writeFileSync(file, "x\n"); // shrunk
		const r2 = readNewFileLines(file, r1!.newSize);
		expect(r2).not.toBeNull();
		expect(r2!.newSize).toBe(0);
		expect(r2!.tail).toBe("");
		expect(r2!.lines).toEqual([]);
	});

	it("carries partial line via lastTail", () => {
		fs.writeFileSync(file, "complete\nincomplete-half");
		const r1 = readNewFileLines(file, 0);
		expect(r1!.lines).toEqual(["complete"]);
		expect(r1!.tail).toBe("incomplete-half");
		fs.appendFileSync(file, "-finished\n");
		const r2 = readNewFileLines(file, r1!.newSize, r1!.tail);
		expect(r2!.lines).toEqual(["incomplete-half-finished"]);
	});
});
