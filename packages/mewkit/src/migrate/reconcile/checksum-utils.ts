// Vendored from claudekit-cli (MIT). Source: src/commands/portable/checksum-utils.ts
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

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

export function computeSectionChecksums(
	sections: Array<{ name: string; content: string }>,
): Record<string, string> {
	const checksums: Record<string, string> = {};
	for (const section of sections) {
		checksums[section.name] = computeContentChecksum(section.content);
	}
	return checksums;
}
