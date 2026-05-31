import fs from "node:fs";
import path from "node:path";

export type GatePolicyProfile = "strict" | "balanced" | "lightweight";

export interface GatePolicy {
	profile: GatePolicyProfile;
	planGate: "hard" | "advisory";
	requireApprovedPlan: boolean;
	contractGate: "hard" | "optional" | "off";
	reviewGate: "hard" | "hard-on-fail" | "advisory";
	buildVerify: "on";
	humanApproval: "required" | "selected" | "optional";
}

export const POLICY_PRESETS: Record<GatePolicyProfile, GatePolicy> = {
	strict: {
		profile: "strict",
		planGate: "hard",
		requireApprovedPlan: true,
		contractGate: "hard",
		reviewGate: "hard",
		buildVerify: "on",
		humanApproval: "required",
	},
	balanced: {
		profile: "balanced",
		planGate: "hard",
		requireApprovedPlan: false,
		contractGate: "optional",
		reviewGate: "hard-on-fail",
		buildVerify: "on",
		humanApproval: "selected",
	},
	lightweight: {
		profile: "lightweight",
		planGate: "advisory",
		requireApprovedPlan: false,
		contractGate: "off",
		reviewGate: "advisory",
		buildVerify: "on",
		humanApproval: "optional",
	},
};

export function policyPath(claudeDir: string): string {
	return path.join(claudeDir, "policy.json");
}

export function parsePolicyProfile(value: string | undefined): GatePolicyProfile | null {
	return value === "strict" || value === "balanced" || value === "lightweight" ? value : null;
}

export function readGatePolicy(claudeDir: string): { policy: GatePolicy; source: string; error?: string } {
	const p = policyPath(claudeDir);
	if (!fs.existsSync(p)) return { policy: POLICY_PRESETS.balanced, source: "default" };
	try {
		const parsed = JSON.parse(fs.readFileSync(p, "utf-8")) as { profile?: string };
		const profile = parsePolicyProfile(parsed.profile);
		if (!profile) return { policy: POLICY_PRESETS.strict, source: p, error: "unknown profile; failing safe as strict" };
		return { policy: POLICY_PRESETS[profile], source: p };
	} catch {
		return { policy: POLICY_PRESETS.strict, source: p, error: "unreadable policy; failing safe as strict" };
	}
}

export function writeGatePolicy(claudeDir: string, profile: GatePolicyProfile): void {
	const p = policyPath(claudeDir);
	const tmp = `${p}.tmp`;
	const body = {
		profile,
		updatedAt: new Date().toISOString(),
		note: "Privacy and prompt-injection blocks are never disabled by policy profiles.",
	};
	fs.writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`, "utf-8");
	fs.renameSync(tmp, p);
}
