// Downloading the three files a verified install needs.
//
// All three or none. A partially downloaded set is indistinguishable from one
// whose signature was stripped in transit, and the refusal a user would see —
// "no signature" — would point them at the publisher rather than at their own
// connection. So a failed fetch of any one of them is a plain download error,
// and verification is only reached once all three are in hand.
import type { KitArtifactAssets } from "./select-release-assets.js";
import type { KitArtifactBytes } from "./verify-kit-artifact.js";

async function fetchBytes(url: string, what: string): Promise<Buffer> {
	const response = await fetch(url, { headers: { "User-Agent": "mewkit" }, redirect: "follow" });
	if (!response.ok) {
		throw new Error(
			`Downloading the kit ${what} failed: ${response.status} ${response.statusText}. Nothing was installed.`,
		);
	}
	return Buffer.from(await response.arrayBuffer());
}

/** Fetch the artifact, its manifest and its signature. Nothing is verified here. */
export async function fetchKitArtifact(assets: KitArtifactAssets): Promise<KitArtifactBytes> {
	const [artifact, manifestBytes, signature] = await Promise.all([
		fetchBytes(assets.artifactUrl, "artifact"),
		fetchBytes(assets.manifestUrl, "manifest"),
		fetchBytes(assets.signatureUrl, "manifest signature"),
	]);
	return { artifact, manifestBytes, signature: signature.toString("utf-8") };
}
