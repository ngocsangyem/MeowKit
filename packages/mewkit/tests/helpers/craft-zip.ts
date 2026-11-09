// A zip writer that stores the member name VERBATIM.
//
// The library the CLI reads zips with normalizes `..` away when it writes one,
// so it cannot produce the archive a traversal test needs. That normalization is
// the library's writer being careful; it says nothing about what its reader does
// with an archive built by something else, which is what a remote release is.
// So the bytes are assembled here instead, with no compression, so the test
// exercises the reader against the archive an attacker would actually publish.
import { crc32 } from "node:zlib";

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

export interface CraftedEntry {
	/** Stored exactly as given, including any `..` segment or leading slash. */
	name: string;
	body: string;
}

/** A stored (uncompressed) zip whose member names are not normalized. */
export function craftZip(entries: CraftedEntry[]): Buffer {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;

	for (const entry of entries) {
		const name = Buffer.from(entry.name, "utf8");
		const body = Buffer.from(entry.body, "utf8");
		const sum = crc32(body);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(LOCAL_SIG, 0);
		local.writeUInt16LE(20, 4); // version needed
		local.writeUInt16LE(0, 6); // flags
		local.writeUInt16LE(0, 8); // stored
		local.writeUInt32LE(sum, 14);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(body.length, 22);
		local.writeUInt16LE(name.length, 26);
		locals.push(local, name, body);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(CENTRAL_SIG, 0);
		central.writeUInt16LE(20, 4); // version made by
		central.writeUInt16LE(20, 6); // version needed
		central.writeUInt16LE(0, 10); // stored
		central.writeUInt32LE(sum, 16);
		central.writeUInt32LE(body.length, 20);
		central.writeUInt32LE(body.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, name);

		offset += local.length + name.length + body.length;
	}

	const centralBytes = Buffer.concat(centrals);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(EOCD_SIG, 0);
	eocd.writeUInt16LE(entries.length, 8);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(centralBytes.length, 12);
	eocd.writeUInt32LE(offset, 16);

	return Buffer.concat([...locals, centralBytes, eocd]);
}
