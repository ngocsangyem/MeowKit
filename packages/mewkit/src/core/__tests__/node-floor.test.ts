// One Node floor, asserted as a property of the repository rather than as four edits that
// happen to agree.
//
// The tree used to state three floors at once — engines said 24, the README said 20, and
// the diagnostic checked 20 and labelled itself "Node.js >= 20" — so a user on Node 20 read
// a supported version, passed `doctor`, and was then refused by the package manager. This
// test extracts every statement and requires one distinct value, which is the only form of
// "aligned" that survives the next edit.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NODE_FLOOR_ENGINES, NODE_FLOOR_MAJOR, NODE_FLOOR_PROSE } from "../node-floor.js";
import { checkNodeVersion } from "../../commands/doctor-checks.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");

const read = (rel: string): string => fs.readFileSync(path.join(REPO_ROOT, rel), "utf-8");

describe("the declared Node floor", () => {
	it("is the same number in every manifest", () => {
		for (const manifest of ["package.json", path.join("packages", "mewkit", "package.json")]) {
			const pkg = JSON.parse(read(manifest)) as { engines?: { node?: string } };
			expect(pkg.engines?.node, manifest).toBe(NODE_FLOOR_ENGINES);
		}
	});

	it("is the same number in the README and the docs pages that state one", () => {
		expect(read("README.md")).toContain(`- ${NODE_FLOOR_PROSE}`);
		for (const page of ["cli/commands.mdx", "cli/project-setup.mdx"]) {
			const text = read(path.join("packages", "docs", "content", "docs", page));
			expect(text, page).toContain(`Node.js ${NODE_FLOOR_MAJOR}+`);
			// The old prose promised a lower floor than `engines` enforced.
			expect(text, page).not.toContain("passes at 20 and up");
		}
	});

	it("is the floor the test matrix runs, so nothing untested is published", () => {
		const workflow = read(path.join(".github", "workflows", "ci.yml"));
		const versions = [...workflow.matchAll(/node-version:\s*(\d+)/g)].map((m) => Number(m[1]));
		expect(versions.length).toBeGreaterThan(0);
		expect([...new Set(versions)]).toEqual([NODE_FLOOR_MAJOR]);
	});

	it("is recorded in an ADR with its measurement, its rejected option and its cost", () => {
		const adrDir = path.join(REPO_ROOT, "docs", "architecture", "adr");
		const adr = fs
			.readdirSync(adrDir)
			.filter((name) => name.includes("node-floor"))
			.map((name) => fs.readFileSync(path.join(adrDir, name), "utf-8"))
			.join("\n");
		expect(adr).not.toBe("");
		expect(adr).toContain(String(NODE_FLOOR_MAJOR));
		expect(adr).toContain("node:sqlite");
		expect(adr.toLowerCase()).toContain("rejected");
	});

	it("is stated once in the source, not restated per reader", () => {
		const src = path.join(REPO_ROOT, "packages", "mewkit", "src");
		const offenders: string[] = [];
		const walk = (dir: string): void => {
			for (const name of fs.readdirSync(dir)) {
				if (name === "node_modules" || name === "__tests__" || name === "orchviz-web") continue;
				const abs = path.join(dir, name);
				if (fs.statSync(abs).isDirectory()) {
					walk(abs);
					continue;
				}
				if (!abs.endsWith(".ts")) continue;
				if (abs.endsWith(path.join("core", "node-floor.ts"))) continue;
				const text = fs.readFileSync(abs, "utf-8");
				// A second literal floor comparison is how the three statements diverged.
				if (/major\s*>=\s*\d\d/.test(text)) offenders.push(path.relative(REPO_ROOT, abs));
			}
		};
		walk(src);
		expect(offenders, offenders.join(", ")).toEqual([]);
	});
});

describe("the diagnostic", () => {
	it("passes at the floor and above, naming the version it found", () => {
		for (const version of [`${NODE_FLOOR_MAJOR}.0.0`, `${NODE_FLOOR_MAJOR + 2}.4.1`]) {
			const result = checkNodeVersion(version);
			expect(result.status, version).toBe("pass");
			expect(result.detail).toContain(version);
			expect(result.name).toContain(String(NODE_FLOOR_MAJOR));
		}
	});

	it("fails below the floor, naming both the requirement and what it found", () => {
		const result = checkNodeVersion(`${NODE_FLOOR_MAJOR - 4}.20.2`);
		expect(result.status).toBe("fail");
		expect(result.name).toContain(String(NODE_FLOOR_MAJOR));
		expect(result.detail).toContain(`${NODE_FLOOR_MAJOR - 4}.20.2`);
		expect(result.detail).toContain(String(NODE_FLOOR_MAJOR));
		expect(result.fix ?? "").toContain(NODE_FLOOR_PROSE);
	});
});
