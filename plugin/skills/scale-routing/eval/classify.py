"""Deterministic task-type classifier — the Track-D reference for routing evals.

Faithful encoding of `../references/task-type-classification.md`: signal keywords →
task_type → suggested_skill, applied in the documented PRIORITY order
(Security > Bug Fix > Intake > the rest by dominant signal). This is the deterministic
slice of routing — the coarse task_type a prompt's literal signals imply. Fine cluster
boundaries (fix vs build-fix vs investigate, brainstorming vs office-hours, review vs
review-pr) and non-English intent are NOT decidable from these literal signals; those are
Track-M cases judged by a model, not here.

`drift_check()` guards this encoding against the source doc so the two cannot silently
diverge: every keyword here must still appear in the doc.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

DOC = Path(__file__).resolve().parent.parent / "references" / "task-type-classification.md"


@dataclass(frozen=True)
class Rule:
    task_type: str
    suggested_skill: str
    keywords: tuple[str, ...]


# Priority order (first match wins), per the doc's "Classification Priority" section:
# Security → Bug Fix → Intake → Review/Refactor/DevOps/Docs → Feature (default).
RULES: tuple[Rule, ...] = (
    Rule("security", "mk:cso", ("vulnerability", "cve", "penetration", "secrets", "audit")),
    Rule("bug_fix", "mk:fix", ("bug", "broken", "regression", "fails", "error")),
    Rule("intake", "mk:intake", ("prd", "ticket", "triage")),
    Rule("review", "mk:review", ("review", "pull request")),
    Rule("refactor", "mk:cook --fast", ("refactor", "clean up", "extract", "rename")),
    Rule("devops", "mk:cook", ("deploy", "ci/cd", "pipeline", "docker", "kubernetes")),
    Rule("documentation", "mk:document-release", ("changelog", "readme", "api docs")),
    Rule("feature", "mk:cook", ("implement", "create", "add")),
)

DEFAULT = Rule("feature", "mk:cook", ())


def _matches(keyword: str, text: str) -> bool:
    """Whole-token match for alphanumeric keywords; substring for phrases/symbols."""
    if re.fullmatch(r"[a-z0-9]+", keyword):
        return re.search(rf"\b{re.escape(keyword)}\b", text) is not None
    return keyword in text


def classify(prompt: str) -> tuple[str, str]:
    """Return (task_type, suggested_skill) for a prompt using the documented signals."""
    text = prompt.lower()
    for rule in RULES:
        if any(_matches(k, text) for k in rule.keywords):
            return rule.task_type, rule.suggested_skill
    return DEFAULT.task_type, DEFAULT.suggested_skill


def drift_check() -> list[str]:
    """Every encoded keyword must still appear in the source doc. Returns drift messages."""
    doc = DOC.read_text(encoding="utf-8").lower()
    missing: list[str] = []
    for rule in RULES:
        for keyword in rule.keywords:
            stem = keyword.strip().rstrip(" #")
            if stem and stem not in doc:
                missing.append(f'{rule.task_type}: "{keyword}" not found in {DOC.name}')
    return missing
