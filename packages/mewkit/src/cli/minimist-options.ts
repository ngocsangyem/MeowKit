// minimist options, derived from the catalogue rather than maintained beside it.
//
// Two failure modes this removes. A flag read but never declared lets minimist guess its type,
// so `--task 123` arrives as the number 123 and `--evidence-ref` values silently change shape.
// A flag declared but never read is dead surface that looks supported: `memory --show` parsed
// cleanly and did nothing for as long as anyone can tell.
import { CLI_CATALOGUE } from "./command-catalogue.js";

export interface MinimistOptions {
	boolean: string[];
	string: string[];
	alias: Record<string, string>;
}

export function minimistOptions(): MinimistOptions {
	const boolean: string[] = [];
	const string: string[] = [];
	for (const flag of CLI_CATALOGUE.flags) {
		(flag.type === "boolean" ? boolean : string).push(flag.name);
	}
	return { boolean, string, alias: { ...CLI_CATALOGUE.aliases } };
}
