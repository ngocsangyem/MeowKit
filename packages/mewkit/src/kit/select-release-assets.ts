// Picking the verified-install assets out of a release's asset list.
//
// All three or nothing. A release carrying an artifact and a manifest but no
// signature is not "two thirds verifiable" — it is a release whose signature is
// missing, and treating it as having an artifact would produce an
// unsigned-artifact refusal where the honest answer is that this release has no
// artifact and installs through its zip like any older one.
//
// Matched by name rather than by position or media type, because an asset list
// is ordered by whatever uploaded it and a release carries other assets too.
import { KIT_MANIFEST_FILENAME, KIT_SIGNATURE_FILENAME } from "./kit-manifest.js";

const ARTIFACT_PREFIX = "meowkit-kit-";
const ARTIFACT_SUFFIX = ".tar.gz";

/** The three assets that together make a release's kit content verifiable. */
export interface KitArtifactAssets {
	artifactUrl: string;
	manifestUrl: string;
	signatureUrl: string;
}

/** One entry of a release's asset list, in the shape the host API returns. */
export interface ReleaseAsset {
	name: string;
	browser_download_url: string;
}

/** The artifact assets of one release, or null unless all three are present. */
export function kitArtifactAssets(assets: readonly ReleaseAsset[]): KitArtifactAssets | null {
	const artifact = assets.find((asset) => asset.name.startsWith(ARTIFACT_PREFIX) && asset.name.endsWith(ARTIFACT_SUFFIX));
	const manifest = assets.find((asset) => asset.name === KIT_MANIFEST_FILENAME);
	const signature = assets.find((asset) => asset.name === KIT_SIGNATURE_FILENAME);
	if (artifact === undefined || manifest === undefined || signature === undefined) return null;
	return {
		artifactUrl: artifact.browser_download_url,
		manifestUrl: manifest.browser_download_url,
		signatureUrl: signature.browser_download_url,
	};
}
