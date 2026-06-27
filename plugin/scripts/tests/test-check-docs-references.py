#!/usr/bin/env python3
"""Unit tests for check-docs-references.py.

Run: python3 .claude/scripts/tests/test-check-docs-references.py
Exits 0 on pass, 1 on fail. Pure stdlib.
"""

from __future__ import annotations

import importlib.util
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / ".claude" / "scripts" / "check-docs-references.py"

spec = importlib.util.spec_from_file_location("check_docs_references", SCRIPT_PATH)
assert spec is not None and spec.loader is not None
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


CONTRACT_FIXTURE = """# Test Contract
<!-- ALLOWLIST-START -->
docs/project-context.md
docs/architecture/
docs/journal/
<!-- ALLOWLIST-END -->

<!-- RESERVED-START -->
docs/future-reserved.md
<!-- RESERVED-END -->
"""


def make_fixture(tmpdir: Path) -> Path:
    claude_dir = tmpdir / ".claude"
    (claude_dir / "rules").mkdir(parents=True)
    (claude_dir / "skills").mkdir()
    (claude_dir / "agents").mkdir()
    (claude_dir / "rules" / "docs-reference-contract.md").write_text(CONTRACT_FIXTURE)
    return claude_dir


class TestExtractTokens(unittest.TestCase):
    def test_basic_token(self):
        self.assertEqual(mod.extract_tokens("See docs/foo.md."), ["docs/foo.md"])

    def test_strips_trailing_punct(self):
        self.assertEqual(mod.extract_tokens("(docs/foo.md)"), ["docs/foo.md"])

    def test_skips_full_url(self):
        self.assertEqual(mod.extract_tokens("see https://example.com/docs/foo for more"), [])

    def test_skips_angle_placeholder(self):
        self.assertEqual(mod.extract_tokens("- [Doc](<path-to-docs/in-project>)"), [])

    def test_bare_dir(self):
        self.assertEqual(mod.extract_tokens("under docs/architecture today"), ["docs/architecture"])

    def test_multiple_tokens_one_line(self):
        result = mod.extract_tokens("docs/a.md and docs/b.md")
        self.assertIn("docs/a.md", result)
        self.assertIn("docs/b.md", result)


class TestIsAllowed(unittest.TestCase):
    def test_exact_match(self):
        self.assertTrue(mod.is_allowed("docs/project-context.md", ["docs/project-context.md"]))

    def test_prefix_match(self):
        self.assertTrue(mod.is_allowed("docs/architecture/adr/123.md", ["docs/architecture/"]))

    def test_no_match(self):
        self.assertFalse(mod.is_allowed("docs/dead-weight-audit.md", ["docs/project-context.md"]))

    def test_partial_no_match(self):
        # docs/architecture (no slash) MUST NOT match docs/architecture/ entry
        # because that would cross the doc-name boundary
        self.assertFalse(mod.is_allowed("docs/architecture-extra.md", ["docs/architecture/"]))


class TestCheckEndToEnd(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.claude = make_fixture(self.tmp)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def write_skill(self, name: str, body: str):
        (self.claude / "skills" / f"{name}.md").write_text(body)

    def test_type1_passes(self):
        self.write_skill("ok", "See docs/project-context.md for conventions.")
        rc = mod.check(self.claude)
        self.assertEqual(rc, 0)

    def test_type2_fails(self):
        self.write_skill("leak", "See docs/dead-weight-audit.md for context.")
        rc = mod.check(self.claude)
        self.assertEqual(rc, 1)

    def test_full_url_passes(self):
        self.write_skill("url", "See https://example.test/docs/dead-weight-audit.")
        rc = mod.check(self.claude)
        self.assertEqual(rc, 0)

    def test_reserved_warn_only(self):
        self.write_skill("reserved", "Watch docs/future-reserved.md when ready.")
        rc = mod.check(self.claude)
        self.assertEqual(rc, 0)

    def test_contract_file_self_exempt(self):
        # The contract file itself enumerates banned paths; must not flag itself
        rc = mod.check(self.claude)
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
