import { describe, expect, it } from "vitest";
import { detectStateChanging } from "../state-changing-script-detector.js";

describe("state-changing script detector", () => {
	it.each([
		['rm -rf "$DIR"', /rm/],
		["git push origin main", /git push/],
		['curl -X POST https://api/x -d "{}"', /mutating HTTP/],
		["curl --request DELETE https://api/x", /mutating HTTP/],
		['echo "{}" > "$out.json"', /redirection/],
		['echo x >> "$log"', /redirection/],
		['export API_TOKEN="$SECRET"', /security-sensitive/],
		["unset ANTHROPIC_API_KEY", /security-sensitive/],
		["open('/tmp/x', 'w')", /Python/],
		["shutil.rmtree(path)", /Python/],
		["fs.writeFileSync(p, data)", /Node fs/],
	])("flags %s as state-changing", (content, reasonRe) => {
		const r = detectStateChanging(content);
		expect(r.stateChanging).toBe(true);
		expect(r.reason).toMatch(reasonRe);
	});

	it.each([
		'cat "$PROJECT_ROOT/config.json"',
		'echo "hello world"',
		"grep -n foo file.txt",
		'model="${MEOWKIT_MODEL_HINT:-${CLAUDE_MODEL:-}}"',
		'result=$(awk "{print}" file)',
		"exit 1 2>&1",
	])("does not flag read-only content: %s", (content) => {
		expect(detectStateChanging(content).stateChanging).toBe(false);
	});

	it("does not treat fd redirects (2>&1) as file writes", () => {
		expect(detectStateChanging("command 2>&1 | grep x").stateChanging).toBe(false);
	});

	// False-positive exclusions that previously mis-escalated read-only scripts.
	it.each([
		["command -v tool >/dev/null 2>&1", "shell"],
		["echo err >&2", "shell"],
		["  if (end > 0) print substr(s, 1, end - 1)", "shell"], // awk comparison in a heredoc
		["  validate.sh <rubric.md>     Validate a single rubric file", "shell"], // usage placeholder
		["# rm -rf $HOME would be dangerous", "shell"], // rm only in a comment
		['  // https://x";rm -rf $HOME;echo would escape the quote boundary.', "node"], // rm in a JS comment
		["# export API_TOKEN=abc (documented, not executed)", "shell"], // export only in a comment
		["    print('> Model differs between runs')", "shell"], // > inside a quoted string
	] as const)("does not flag read-only/comment/usage content: %s", (content, lang) => {
		expect(detectStateChanging(content, lang).stateChanging).toBe(false);
	});

	it("still flags a quoted redirect target as a write", () => {
		expect(detectStateChanging('echo "{}" > "$cost_log"', "shell").stateChanging).toBe(true);
	});
});
