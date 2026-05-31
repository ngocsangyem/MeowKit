import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import * as p from "@clack/prompts";
import { parsePolicyProfile, readGatePolicy, writeGatePolicy, type GatePolicyProfile } from "../core/gate-policy.js";

export interface PolicyArgs {
	subcommand?: string;
	profile?: string;
	json?: boolean;
	yes?: boolean;
}

function findClaudeDir(): string | null {
	const candidate = path.join(process.cwd(), ".claude");
	return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : null;
}

async function confirmWeakening(current: GatePolicyProfile, next: GatePolicyProfile, yes?: boolean): Promise<boolean> {
	if (yes || current === next) return true;
	const rank = { lightweight: 1, balanced: 2, strict: 3 } satisfies Record<GatePolicyProfile, number>;
	if (rank[next] >= rank[current]) return true;
	const ok = await p.confirm({ message: `Switch policy from ${current} to weaker ${next}?`, initialValue: false });
	return !p.isCancel(ok) && ok === true;
}

export async function policy(args: PolicyArgs = {}): Promise<void> {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}
	const sub = args.subcommand ?? "explain";
	const current = readGatePolicy(claudeDir);
	if (sub === "explain") {
		if (args.json) {
			console.log(JSON.stringify(current, null, 2));
			return;
		}
		console.log(pc.bold(pc.cyan("MeowKit gate policy")));
		console.log(`${pc.dim("Profile:")} ${current.policy.profile}`);
		console.log(`${pc.dim("Source:")} ${current.source}`);
		if (current.error) console.log(`${pc.yellow("Warning:")} ${current.error}`);
		console.log(`  plan gate: ${current.policy.planGate}`);
		console.log(`  approved plan required: ${String(current.policy.requireApprovedPlan)}`);
		console.log(`  contract gate: ${current.policy.contractGate}`);
		console.log(`  review gate: ${current.policy.reviewGate}`);
		console.log(`  build verify: ${current.policy.buildVerify}`);
		console.log(`  human approval: ${current.policy.humanApproval}`);
		console.log(pc.dim("Privacy and prompt-injection blocks are never disabled by policy."));
		return;
	}
	if (sub === "set") {
		const next = parsePolicyProfile(args.profile);
		if (!next) {
			console.error(pc.red(`Unknown policy profile: ${args.profile ?? "(missing)"}`));
			console.log(pc.dim("Usage: mewkit policy set <strict|balanced|lightweight>"));
			process.exit(1);
		}
		if (!(await confirmWeakening(current.policy.profile, next, args.yes))) {
			console.log(pc.dim("Cancelled."));
			return;
		}
		writeGatePolicy(claudeDir, next);
		console.log(pc.green(`Policy set to ${next}.`));
		return;
	}
	console.error(pc.red(`Unknown policy subcommand: ${sub}`));
	console.log(pc.dim("Usage: mewkit policy <explain|set> [profile]"));
	process.exit(1);
}
