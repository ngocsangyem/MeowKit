import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	BASE_RE,
	SKILL_ID_RE,
	_resetWarnState,
	parseSkillId,
	resolveLegacy,
} from "../discovery/skill-id-utils.js";

describe("skill-id-utils", () => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let stderrSpy: any;

	beforeEach(() => {
		_resetWarnState();
		stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((() => true) as never);
	});

	afterEach(() => {
		stderrSpy.mockRestore();
	});

	describe("parseSkillId", () => {
		it("returns mk:<base> from valid mk: frontmatter", () => {
			expect(parseSkillId("mk:cook", "cook")).toBe("mk:cook");
			expect(stderrSpy).not.toHaveBeenCalled();
		});

		it("normalizes legacy meow: frontmatter to mk:", () => {
			expect(parseSkillId("meow:cook", "meow:cook")).toBe("mk:cook");
			expect(stderrSpy).toHaveBeenCalledTimes(1);
		});

		it("falls back to mk:<base> when frontmatter is absent (post-rename folder)", () => {
			expect(parseSkillId(undefined, "cook")).toBe("mk:cook");
		});

		it("falls back to mk:<base> when frontmatter is absent (legacy meow: folder)", () => {
			expect(parseSkillId(undefined, "meow:cook")).toBe("mk:cook");
		});

		it("falls back when frontmatter is malformed (template syntax)", () => {
			expect(parseSkillId("meow:{name}", "cook")).toBe("mk:cook");
		});

		it("rejects path-traversal in folder basename", () => {
			expect(() => parseSkillId(undefined, "meow:../../config")).toThrow(
				/Invalid skill folder basename/,
			);
		});

		it("rejects basenames with uppercase or invalid chars", () => {
			expect(() => parseSkillId(undefined, "Cook")).toThrow();
			expect(() => parseSkillId(undefined, "cook with space")).toThrow();
		});
	});

	describe("resolveLegacy", () => {
		it("maps meow:<x> to mk:<x>", () => {
			expect(resolveLegacy("meow:cook")).toBe("mk:cook");
		});

		it("passes mk:<x> through unchanged", () => {
			expect(resolveLegacy("mk:cook")).toBe("mk:cook");
			expect(stderrSpy).not.toHaveBeenCalled();
		});

		it("emits stderr deprecation warning exactly once per id per session", () => {
			resolveLegacy("meow:cook");
			resolveLegacy("meow:cook");
			resolveLegacy("meow:cook");
			expect(stderrSpy).toHaveBeenCalledTimes(1);
			const call = stderrSpy.mock.calls[0]?.[0] as string;
			expect(call).toContain("meow:cook");
			expect(call).toContain("mk:cook");
		});

		it("warns separately for distinct legacy ids", () => {
			resolveLegacy("meow:cook");
			resolveLegacy("meow:scout");
			expect(stderrSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe("regex exports", () => {
		it("SKILL_ID_RE accepts canonical and legacy forms", () => {
			expect(SKILL_ID_RE.test("mk:cook")).toBe(true);
			expect(SKILL_ID_RE.test("meow:cook")).toBe(true);
			expect(SKILL_ID_RE.test("mk:Cook")).toBe(false);
			expect(SKILL_ID_RE.test("foo:bar")).toBe(false);
		});

		it("BASE_RE rejects path traversal and invalid chars", () => {
			expect(BASE_RE.test("cook")).toBe(true);
			expect(BASE_RE.test("agent-browser")).toBe(true);
			expect(BASE_RE.test("../../config")).toBe(false);
			expect(BASE_RE.test("Cook")).toBe(false);
			expect(BASE_RE.test("a".repeat(64))).toBe(false);
		});
	});
});
