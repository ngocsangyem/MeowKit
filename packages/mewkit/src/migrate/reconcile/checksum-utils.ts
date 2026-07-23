// Vendored from claudekit-cli (MIT). Source: src/commands/portable/checksum-utils.ts
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const CHECKSUM_HEX_LENGTH = 64;
const BINARY_DETECTION_SAMPLE_BYTES = 8 * 1024;

function computeSha256Hex(input: string | Buffer): string {
	const hash = createHash("sha256");
	if (typeof input === "string") hash.update(input, "utf-8");
	else hash.update(input);
	return hash.digest("hex").slice(0, CHECKSUM_HEX_LENGTH);
}

export function computeContentChecksum(content: string): string {
	return computeSha256Hex(content);
}

export function isBinaryContent(buffer: Buffer): boolean {
	const sample = buffer.subarray(0, BINARY_DETECTION_SAMPLE_BYTES);
	return sample.includes(0);
}

export async function computeFileChecksum(filePath: string): Promise<string> {
	const buffer = await readFile(filePath);
	return computeSha256Hex(buffer);
}

/** List every file under `dir` recursively, as project-`dir`-relative POSIX paths. */
async function listFilesRecursive(dir: string, base = dir): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFilesRecursive(abs, base)));
		} else if (entry.isFile()) {
			files.push(relative(base, abs).split(sep).join("/"));
		}
	}
	return files;
}

/** Deterministic checksum of a directory TREE: hashes each file's relative path +
 *  content, in sorted-path order. Any add / remove / edit / rename inside the tree
 *  changes the result. Used to reconcile whole-directory manifest entries (agents/,
 *  skills/) as single units. */
export async function computeTreeChecksum(dirPath: string): Promise<string> {
	const relPaths = (await listFilesRecursive(dirPath)).sort();
	const hash = createHash("sha256");
	for (const rel of relPaths) {
		const fileHash = await computeFileChecksum(join(dirPath, ...rel.split("/")));
		hash.update(`${rel}\0${fileHash}\n`, "utf-8");
	}
	return hash.digest("hex").slice(0, CHECKSUM_HEX_LENGTH);
}

export function computeSectionChecksums(sections: Array<{ name: string; content: string }>): Record<string, string> {
	const checksums: Record<string, string> = {};
	for (const section of sections) {
		checksums[section.name] = computeContentChecksum(section.content);
	}
	return checksums;
}
