#!/usr/bin/env node
/**
 * A tar + gzip writer whose output depends on the content and on nothing else.
 *
 * The archive's digest is the kit's identity: the manifest names it, the
 * signature covers the manifest, and one digest check then authenticates every
 * file. That only works if identical content yields an identical digest, so the
 * four things a filesystem would otherwise contribute are pinned here instead:
 *
 *   member order  — the caller supplies a sorted list; nothing reads readdir order
 *   member mtime  — written as 0, so the time of the build cannot change the bytes
 *   uid/gid/mode  — 0/0, and mode decided by the content, never by the on-disk bits
 *   gzip header   — MTIME, XFL and OS written explicitly rather than taken from zlib
 *
 * Without those, two builds of one commit on two machines produce two digests
 * for the same kit, and a digest mismatch then means nothing: a user cannot tell
 * a rebuild from a tampered artifact.
 *
 * ustar is written by hand because the platform ships no archive writer and the
 * build may add no dependency — a signing pipeline that pulls in a transitive
 * tree widens exactly the trust boundary it exists to narrow.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BLOCK = 512;
const FILE_MODE = 0o644;
const EXEC_MODE = 0o755;

function octal(value, width) {
	return value.toString(8).padStart(width - 1, "0") + "\0";
}

/**
 * A NUL-terminated ustar field: the numeric ones, which are an octal string plus
 * a terminator. One byte is reserved for the terminator, so the value gets
 * `length - 1`.
 */
function writeTerminated(block, value, offset, length) {
	block.write(value.slice(0, length - 1), offset, length - 1, "ascii");
}

/**
 * A ustar NAME field: `name` and `prefix`, which are NOT NUL-terminated when
 * they fill the field. They get the full width.
 *
 * Reserving a terminator byte here was a one-byte truncation at the boundary: a
 * 100-byte member path was written as 99, and because the manifest is derived
 * from the archive that was just built, the truncated name is the one that gets
 * hashed, listed and signed. Verification would then pass on an artifact that
 * installs one file at the wrong path and leaves the right path missing — the
 * exact outcome this writer's refusal exists to prevent.
 *
 * Callers must have already refused anything that does not fit, so a value too
 * long to fit arriving here is a bug in the caller rather than a long path, and
 * it raises instead of being quietly shortened.
 */
function writeName(block, value, offset, length) {
	if (Buffer.byteLength(value) > length) {
		throw new Error(`archive member path field overflow at offset ${offset}: ${value}`);
	}
	block.write(value, offset, length, "ascii");
}

const NAME_FIELD = 100;
const PREFIX_FIELD = 155;

/**
 * One ustar header. A `name` over 100 bytes is split across the `prefix` and
 * `name` fields, which is the plain ustar long-name form; a path too long for
 * even that is refused rather than silently truncated to a different file.
 *
 * The split point must leave a base of at most 100 bytes and a prefix of at most
 * 155, and the `/` that separates them is not stored — so the longest
 * representable path is 256 bytes, and the search for a split starts at the last
 * `/` that could still leave a legal prefix.
 */
function header(name, size, mode) {
	const block = Buffer.alloc(BLOCK);
	let prefix = "";
	let base = name;
	if (Buffer.byteLength(name) > NAME_FIELD) {
		// The separator is dropped, so a prefix may be up to PREFIX_FIELD bytes and
		// the cut may sit at index PREFIX_FIELD itself.
		const cut = name.lastIndexOf("/", PREFIX_FIELD);
		if (cut <= 0) throw new Error(`archive member path too long for ustar: ${name}`);
		prefix = name.slice(0, cut);
		base = name.slice(cut + 1);
		// Both halves are checked in BYTES while the split above is found by code
		// unit, so a path with any character outside ASCII can produce a prefix that
		// is 155 units and more than 155 bytes. That is the case this guard catches;
		// for a pure-ASCII path it is bounded by the search and never fires.
		if (Buffer.byteLength(base) > NAME_FIELD || Buffer.byteLength(prefix) > PREFIX_FIELD) {
			throw new Error(`archive member path too long for ustar: ${name}`);
		}
	}
	writeName(block, base, 0, NAME_FIELD);
	writeTerminated(block, octal(mode, 8), 100, 8);
	writeTerminated(block, octal(0, 8), 108, 8); // uid
	writeTerminated(block, octal(0, 8), 116, 8); // gid
	writeTerminated(block, octal(size, 12), 124, 12);
	writeTerminated(block, octal(0, 12), 136, 12); // mtime
	block.write("        ", 148, 8, "ascii"); // checksum placeholder
	block.write("0", 156, 1, "ascii"); // regular file
	block.write("ustar\0", 257, 6, "ascii");
	block.write("00", 263, 2, "ascii");
	// uname/gname stay empty: a build machine's account names are not kit content.
	writeTerminated(block, octal(0, 8), 329, 8); // devmajor
	writeTerminated(block, octal(0, 8), 337, 8); // devminor
	if (prefix !== "") writeName(block, prefix, 345, PREFIX_FIELD);

	let sum = 0;
	for (const byte of block) sum += byte;
	writeTerminated(block, octal(sum, 8), 148, 8);
	block.write(" ", 155, 1, "ascii");
	return block;
}

function padding(size) {
	const remainder = size % BLOCK;
	return remainder === 0 ? Buffer.alloc(0) : Buffer.alloc(BLOCK - remainder);
}

/**
 * The mode a member is recorded with, decided by the file's own bytes.
 *
 * The on-disk bits are deliberately not read. A working copy picks up execute
 * bits from umask, from an editor, from a checkout on a filesystem that has no
 * permission model at all — so a mode taken from disk makes the digest depend on
 * the machine. A shebang, by contrast, is in the content the digest already
 * covers, and it is also the only thing that makes a kit file runnable on its
 * own, so deriving the bit from it both pins the archive and keeps scripts
 * executable.
 */
function contentMode(content) {
	return content.length >= 2 && content[0] === 0x23 && content[1] === 0x21 ? EXEC_MODE : FILE_MODE;
}

/**
 * Build the uncompressed tar for `files` (repo-relative, forward slashes, in the
 * order given). Directory members are omitted: an extractor creates parents, and
 * a directory entry carries only metadata that is pinned away anyway.
 */
function buildTar(projectRoot, files) {
	const chunks = [];
	for (const rel of files) {
		const abs = path.join(projectRoot, rel.split("/").join(path.sep));
		const content = fs.readFileSync(abs);
		chunks.push(header(rel, content.length, contentMode(content)), content, padding(content.length));
	}
	chunks.push(Buffer.alloc(BLOCK * 2)); // two zero blocks end the archive
	return Buffer.concat(chunks);
}

/**
 * Wrap deflate output in a gzip container whose every header byte is fixed.
 * `zlib.gzipSync` would supply an OS byte from the build platform, so the same
 * content would differ between a Linux runner and a developer's machine.
 */
function gzipDeterministic(payload) {
	const head = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0xff]);
	const body = zlib.deflateRawSync(payload, { level: 9 });
	const trailer = Buffer.alloc(8);
	trailer.writeUInt32LE(zlib.crc32 ? zlib.crc32(payload) : crc32(payload), 0);
	trailer.writeUInt32LE(payload.length >>> 0, 4);
	return Buffer.concat([head, body, trailer]);
}

let CRC_TABLE = null;
function crc32(buffer) {
	if (CRC_TABLE === null) {
		CRC_TABLE = new Int32Array(256);
		for (let i = 0; i < 256; i += 1) {
			let c = i;
			for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			CRC_TABLE[i] = c;
		}
	}
	let crc = -1;
	for (const byte of buffer) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
	return (crc ^ -1) >>> 0;
}

module.exports = { NAME_FIELD, PREFIX_FIELD, buildTar, gzipDeterministic };
