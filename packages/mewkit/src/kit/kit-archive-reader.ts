// Reading the kit archive into members, in memory, without running anything.
//
// Nothing from the archive is executed, required, imported or spawned at any
// point: the archive is parsed as bytes and its members are handed back as
// buffers. That is the whole reason a hand-written reader exists rather than a
// shell-out to `tar` — an external extractor decides for itself what a member
// path, a symlink or a device entry means, and those decisions are exactly the
// ones that must be made here, before anything reaches the filesystem.
//
// Only regular files are returned. A symlink, hardlink, device or directory
// member is reported so the caller can refuse it: a symlink member is the
// classic way to make a later regular-file member land outside the destination,
// and silently dropping it would leave the caller believing the archive was
// ordinary.
import { gunzipSync } from "node:zlib";

const BLOCK = 512;

export interface ArchiveMember {
	path: string;
	content: Buffer;
	/** The mode the archive recorded, which the build derived from the content. */
	mode: number;
}

export interface ArchiveContents {
	members: ArchiveMember[];
	/** Paths of members that are not regular files, so the caller can refuse them. */
	nonRegular: string[];
}

const trimField = (raw: Buffer): string => raw.toString("ascii").replace(/\0.*$/, "").trim();

function parseOctal(raw: Buffer): number {
	const text = trimField(raw);
	if (text === "") return 0;
	const value = parseInt(text, 8);
	return Number.isFinite(value) ? value : Number.NaN;
}

/** Inflate and parse the archive. Throws on anything it cannot read as a tar. */
export function readKitArchive(artifact: Buffer): ArchiveContents {
	const tar = gunzipSync(artifact);
	const members: ArchiveMember[] = [];
	const nonRegular: string[] = [];
	let offset = 0;

	while (offset + BLOCK <= tar.length) {
		const head = tar.subarray(offset, offset + BLOCK);
		if (head.every((byte) => byte === 0)) break;

		const base = trimField(head.subarray(0, 100));
		const prefix = trimField(head.subarray(345, 500));
		const size = parseOctal(head.subarray(124, 136));
		const typeFlag = String.fromCharCode(head[156]);
		if (!Number.isFinite(size) || size < 0) throw new Error("archive member has an unreadable size");

		const name = prefix === "" ? base : `${prefix}/${base}`;
		const start = offset + BLOCK;
		if (start + size > tar.length) throw new Error("archive member extends past the end of the archive");

		// "0" and "\0" are both regular files; "\0" is the historic form.
		if (typeFlag === "0" || typeFlag === "\0") {
			const mode = parseOctal(head.subarray(100, 108));
			members.push({
				path: name,
				content: tar.subarray(start, start + size),
				// A mode the archive states unreadably is not a reason to refuse the
				// file; it is a reason not to grant it anything.
				mode: Number.isFinite(mode) ? mode & 0o777 : 0o644,
			});
		} else if (typeFlag !== "x" && typeFlag !== "g") {
			// pax extended headers carry metadata for the next member, not a member.
			nonRegular.push(name);
		}
		offset = start + Math.ceil(size / BLOCK) * BLOCK;
	}

	return { members, nonRegular };
}
