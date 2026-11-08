// The docs-reference contract is a source-repo-only maintainer document that is NOT
// shipped into user projects. These tests pin where it is resolved from and that its
// absence is N/A (exit-0 semantics) rather than a failure — the Python twin
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkDocsReferences, formatReport } from "../check-docs-references.js";
import { CONTRACT_REL_PATH, resolveContractPath } from "../docs-reference-contract-paths.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const CONTRACT = `# contract

<!-- ALLOWLIST-START -->
docs/project-context.md
<!-- ALLOWLIST-END -->
`;

/** A project tree whose `.claude/` leaks a non-allowlisted docs path. */
async function makeProject(withContract: boolean): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mewkit-docs-contract-"));
	tempDirs.push(root);
	const claude = join(root, ".claude");
	await mkdir(join(claude, "skills"), { recursive: true });
	await writeFile(join(claude, "skills", "leak.md"), "See docs/dead-weight-audit.md.\n", "utf-8");
	if (withContract) {
		const contract = join(root, CONTRACT_REL_PATH);
		await mkdir(join(contract, ".."), { recursive: true });
		await writeFile(contract, CONTRACT, "utf-8");
	}
	return root;
}

describe("docs-reference contract resolution", () => {
	it("resolves repo-root-relative, outside .claude/", async () => {
		const root = await makeProject(true);
		expect(CONTRACT_REL_PATH).toBe(join("docs", "maintainer", "docs-reference-contract.md"));
		expect(resolveContractPath(join(root, ".claude"))).toBe(join(root, CONTRACT_REL_PATH));
	});

	it("flags the leak when the contract is present", async () => {
		const root = await makeProject(true);
		const result = checkDocsReferences(join(root, ".claude"));
		expect(result.notApplicable).toBeUndefined();
		expect(result.errorCount).toBe(1);
	});

	it("is N/A — not a failure — when the contract is absent, even with the same leak", async () => {
		const root = await makeProject(false);
		const result = checkDocsReferences(join(root, ".claude"));
		expect(result.notApplicable).toBe(true);
		expect(result.errorCount).toBe(0);
		expect(result.findings).toEqual([]);
		expect(formatReport(result)).toContain("N/A");
	});
});
