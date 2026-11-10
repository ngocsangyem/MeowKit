// Building a kit artifact, its manifest and its signature from scratch, so a
// test can produce one that is valid and then make exactly one thing wrong.
//
// The production build script could produce the valid case, but not the ten
// invalid ones: it refuses to emit anything it cannot sign, which is the
// property under test elsewhere. Crafting the bytes here is what lets each
// tamper variant differ from the good bundle in a single, named way — so a
// refusal can be attributed to that one thing rather than to the fixture.
import { createHash, createPrivateKey, generateKeyPairSync, sign as cryptoSign } from "node:crypto";
import { gzipSync } from "node:zlib";

const BLOCK = 512;

export const sha256 = (buffer: Buffer): string => createHash("sha256").update(buffer).digest("hex");

export interface CraftedMember {
	name: string;
	body: string;
	/** ustar type flag: "0" regular, "2" symlink, "5" directory, "3"/"4" device. */
	typeFlag?: string;
	linkName?: string;
}

export interface CraftedBundle {
	artifact: Buffer;
	manifestBytes: Buffer;
	signature: string | null;
}

/** An ephemeral keypair. No key material is ever committed. */
export function ephemeralKitKeys(): { privatePem: string; publicPem: string } {
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	return {
		privatePem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
		publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
	};
}

export function signBytes(bytes: Buffer, privatePem: string): string {
	return cryptoSign(null, bytes, createPrivateKey(privatePem)).toString("base64");
}

/** One ustar header, with the fields the production writer pins. */
function header(member: CraftedMember): Buffer {
	const head = Buffer.alloc(BLOCK);
	const put = (value: string, offset: number, length: number): void => {
		head.write(value.slice(0, length - 1), offset, length - 1, "ascii");
	};
	const octal = (value: number, width: number): string => value.toString(8).padStart(width - 1, "0") + "\0";
	put(member.name, 0, 100);
	put(octal(0o644, 8), 100, 8);
	put(octal(0, 8), 108, 8);
	put(octal(0, 8), 116, 8);
	put(octal(Buffer.byteLength(member.body), 12), 124, 12);
	put(octal(0, 12), 136, 12);
	head.write("        ", 148, 8, "ascii");
	head.write(member.typeFlag ?? "0", 156, 1, "ascii");
	if (member.linkName !== undefined && member.linkName !== "") put(member.linkName, 157, 100);
	head.write("ustar\0", 257, 6, "ascii");
	head.write("00", 263, 2, "ascii");
	let sum = 0;
	for (const byte of head) sum += byte;
	put(octal(sum, 8), 148, 8);
	head.write(" ", 155, 1, "ascii");
	return head;
}

/** A complete, valid artifact + manifest + signature for `members`. */
export function craftKitBundle(members: CraftedMember[], version: string, privatePem: string): CraftedBundle {
	const chunks: Buffer[] = [];
	for (const member of members) {
		const content = Buffer.from(member.body, "utf8");
		const pad = content.length % BLOCK === 0 ? Buffer.alloc(0) : Buffer.alloc(BLOCK - (content.length % BLOCK));
		chunks.push(header(member), content, pad);
	}
	chunks.push(Buffer.alloc(BLOCK * 2));
	const artifact = gzipSync(Buffer.concat(chunks));

	const manifest = {
		schemaVersion: "1.0",
		version,
		artifact: { name: `meowkit-kit-${version}.tar.gz`, sha256: sha256(artifact), size: artifact.length },
		files: members
			.filter((member) => (member.typeFlag ?? "0") === "0")
			.map((member) => ({
				path: member.name,
				sha256: sha256(Buffer.from(member.body, "utf8")),
				size: Buffer.byteLength(member.body),
			})),
	};
	const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	return { artifact, manifestBytes, signature: signBytes(manifestBytes, privatePem) };
}

/** Re-sign a modified manifest, so only the thing under test is wrong. */
export function resignBundle(bundle: CraftedBundle, manifestBytes: Buffer, privatePem: string): CraftedBundle {
	return { ...bundle, manifestBytes, signature: signBytes(manifestBytes, privatePem) };
}

/** A copy with one bit flipped, for the "a single byte changed" variants. */
export function flipOneBit(buffer: Buffer, offset: number): Buffer {
	const copy = Buffer.from(buffer);
	copy[offset] ^= 0x01;
	return copy;
}
