#!/usr/bin/env python3
"""Unit tests for scripts/validate-skill-frontmatter.py — tool-contract advisory checks.

Run with an interpreter that has pyyaml + jsonschema (the kit venv):
  .claude/skills/.venv/bin/python3 .claude/scripts/tests/test-validate-skill-frontmatter.py

Exits 0 on pass, 1 on fail. Invokes the validator as a subprocess via sys.executable,
so the validator runs under the same (dependency-equipped) interpreter as this test.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
VALIDATOR = REPO_ROOT / "scripts" / "validate-skill-frontmatter.py"
SCHEMA = REPO_ROOT / ".claude" / "schemas" / "skill-schema.json"


def make_root(tmp: Path, skills: dict[str, str]) -> Path:
    """Build a throwaway project root with the real schema + the given SKILL.md bodies."""
    claude = tmp / ".claude"
    (claude / "schemas").mkdir(parents=True)
    (claude / "schemas" / "skill-schema.json").write_text(SCHEMA.read_text())
    for name, body in skills.items():
        d = claude / "skills" / name
        d.mkdir(parents=True)
        (d / "SKILL.md").write_text(body)
    return tmp


def run_validator(root: Path, strict: bool = False) -> subprocess.CompletedProcess:
    cmd = [sys.executable, str(VALIDATOR), str(root)]
    if strict:
        cmd.append("--strict")
    return subprocess.run(cmd, capture_output=True, text=True)


# Frontmatter fragments
ENV_BODY_SKILL = """---
name: mk:test-env
description: A skill that calls an external Jira service for testing.
when_to_use: Use to test the external-service env-var detection path.
---

# Test Env

Set MEOW_JIRA_BASE_URL before invoking.
"""

JIRA_LEAF_NO_FIELD = """---
name: mk:test-jira-leaf
description: A user-invocable Jira leaf skill for testing the owner/agent marker path.
when_to_use: Use to test the frontmatter-marker detection path.
user-invocable: true
owner: jira
agent: jira-issue
---

# Test Jira Leaf

No env var in the body — detected via owner/agent frontmatter marker.
"""

ANNOTATED_SKILL = """---
name: mk:test-annotated
description: A fully annotated external-service skill for testing the no-warn path.
when_to_use: Use to test that annotated skills produce no tool-contract warning.
owner: jira
agent: jira-issue
requires_external_service: ["jira"]
default_enabled: false
---

# Test Annotated

Set MEOW_JIRA_BASE_URL before invoking.
"""

REQUIRES_NO_DEFAULT = """---
name: mk:test-missing-default
description: A skill that declares requires_external_service but omits default_enabled.
when_to_use: Use to test the default_enabled cross-check warning.
requires_external_service: ["jira"]
---

# Test Missing Default

Body text.
"""

PLAIN_SKILL = """---
name: mk:test-plain
description: A plain non-external skill that must not trigger any tool-contract warning.
when_to_use: Use to confirm plain skills are unaffected.
---

# Test Plain

Just a normal skill.
"""


class TestToolContractWarnings(unittest.TestCase):
    def test_env_body_without_field_warns(self):
        with tempfile.TemporaryDirectory() as t:
            root = make_root(Path(t), {"test-env": ENV_BODY_SKILL})
            r = run_validator(root)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("requires_external_service", r.stderr)

    def test_jira_leaf_marker_without_field_warns(self):
        with tempfile.TemporaryDirectory() as t:
            root = make_root(Path(t), {"test-jira-leaf": JIRA_LEAF_NO_FIELD})
            r = run_validator(root)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("requires_external_service", r.stderr)

    def test_strict_promotes_warning_to_error(self):
        with tempfile.TemporaryDirectory() as t:
            root = make_root(Path(t), {"test-jira-leaf": JIRA_LEAF_NO_FIELD})
            r = run_validator(root, strict=True)
            self.assertEqual(r.returncode, 1, r.stderr)

    def test_annotated_skill_no_warning(self):
        with tempfile.TemporaryDirectory() as t:
            root = make_root(Path(t), {"test-annotated": ANNOTATED_SKILL})
            r = run_validator(root)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertNotIn("requires_external_service", r.stderr)
            self.assertNotIn("default_enabled", r.stderr)

    def test_requires_present_default_absent_warns(self):
        with tempfile.TemporaryDirectory() as t:
            root = make_root(Path(t), {"test-missing-default": REQUIRES_NO_DEFAULT})
            r = run_validator(root)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("default_enabled", r.stderr)

    def test_plain_skill_no_tool_contract_warning(self):
        with tempfile.TemporaryDirectory() as t:
            root = make_root(Path(t), {"test-plain": PLAIN_SKILL})
            r = run_validator(root)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertNotIn("requires_external_service", r.stderr)


class TestSchemaAcceptsNewFields(unittest.TestCase):
    def test_schema_validates_new_fields(self):
        try:
            import jsonschema
        except ImportError:
            self.skipTest("jsonschema not available")
        schema = json.loads(SCHEMA.read_text())
        fm = {
            "name": "mk:test",
            "description": "A test skill with the new advisory tool-contract fields.",
            "requires_external_service": ["jira", "confluence"],
            "default_enabled": False,
            "stable_output_contract": True,
        }
        jsonschema.validate(fm, schema)  # raises on failure

    def test_schema_rejects_unknown_dependency_edge_type(self):
        import jsonschema
        schema = json.loads(SCHEMA.read_text())
        fm = {
            "name": "mk:test",
            "description": "A skill with an invalid dependency edge type.",
            "dependency_edges": [{"id": "mk:other", "type": "unsupported"}],
        }
        with self.assertRaises(jsonschema.ValidationError):
            jsonschema.validate(fm, schema)


if __name__ == "__main__":
    unittest.main()
