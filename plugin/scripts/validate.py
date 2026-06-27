#!/usr/bin/env python3
"""Comprehensive deterministic validation — runs at Phase 4 review gate.

Usage: python validate.py [directory]
Requirements: Python 3.9+, no external dependencies.
"""

import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import NamedTuple


class Finding(NamedTuple):
    severity: str  # BLOCK, WARN, PASS
    description: str
    file: str
    line: int


# ---------------------------------------------------------------------------
# Security checks (same as post-write.sh, applied comprehensively)
# ---------------------------------------------------------------------------

def check_ts_js(filepath: Path, content: str) -> list[Finding]:
    findings = []
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        if re.search(r'(api_key|apiKey|secret|password|token)\s*=\s*["\x27]', line):
            findings.append(Finding("BLOCK", "Hardcoded secret detected", str(filepath), i))
        if re.search(r':\s*any\b', line) or re.search(r'\bas\s+any\b', line):
            findings.append(Finding("BLOCK", "Usage of 'any' type", str(filepath), i))
        if re.search(r'process\.env\.', line):
            findings.append(Finding("WARN", "process.env without validation", str(filepath), i))
        if re.search(r'`[^`]*(SELECT|INSERT|UPDATE|DELETE)', line):
            findings.append(Finding("BLOCK", "Potential SQL injection via template literal", str(filepath), i))
        if re.search(r'jwt.*secret.*=.*["\x27]', line, re.IGNORECASE):
            findings.append(Finding("BLOCK", "JWT secret in source code", str(filepath), i))
    return findings


def check_vue(filepath: Path, content: str) -> list[Finding]:
    findings = []
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        if re.search(r'v-html', line):
            findings.append(Finding("BLOCK", "v-html with dynamic content (XSS risk)", str(filepath), i))
        if re.search(r'localStorage.*(token|auth)', line, re.IGNORECASE):
            findings.append(Finding("BLOCK", "localStorage used for tokens/auth", str(filepath), i))
    return findings


def check_swift(filepath: Path, content: str) -> list[Finding]:
    findings = []
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        if re.search(r'UserDefaults.*(password|token|secret)', line, re.IGNORECASE):
            findings.append(Finding("BLOCK", "UserDefaults used for sensitive data", str(filepath), i))
        if re.search(r'(allowsInvalidSSLCertificate|disableCertificatePinning)', line):
            findings.append(Finding("BLOCK", "Disabled certificate validation", str(filepath), i))
    return findings


def check_sql(filepath: Path, content: str) -> list[Finding]:
    findings = []
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        if re.search(r'ENABLE ROW LEVEL SECURITY.*false|NO FORCE ROW LEVEL SECURITY', line, re.IGNORECASE):
            findings.append(Finding("BLOCK", "RLS disabled", str(filepath), i))
        if re.search(r'CASCADE', line):
            findings.append(Finding("WARN", "CASCADE detected — review carefully", str(filepath), i))
    return findings


# ---------------------------------------------------------------------------
# Framework-specific checks
# ---------------------------------------------------------------------------

def check_nestjs_guards(filepath: Path, content: str) -> list[Finding]:
    """Find controllers missing @UseGuards."""
    findings = []
    lines = content.splitlines()
    has_controller = False
    has_useguards = False
    controller_line = 0
    for i, line in enumerate(lines, 1):
        if re.search(r'@Controller\b', line):
            has_controller = True
            controller_line = i
        if re.search(r'@UseGuards\b', line):
            has_useguards = True
    if has_controller and not has_useguards:
        findings.append(Finding("BLOCK", "NestJS controller missing @UseGuards", str(filepath), controller_line))
    return findings


def check_nestjs_dto_validation(filepath: Path, content: str) -> list[Finding]:
    """Find DTOs missing validation decorators."""
    findings = []
    lines = content.splitlines()
    in_dto_class = False
    dto_line = 0
    has_validation = False
    for i, line in enumerate(lines, 1):
        if re.search(r'class\s+\w*Dto\b', line):
            if in_dto_class and not has_validation:
                findings.append(Finding("WARN", "DTO class missing validation decorators", str(filepath), dto_line))
            in_dto_class = True
            dto_line = i
            has_validation = False
        if in_dto_class and re.search(r'@(IsString|IsNumber|IsEmail|IsNotEmpty|IsOptional|IsBoolean|IsArray|IsEnum|IsDate|ValidateNested|Min|Max|Length|Matches)\b', line):
            has_validation = True
    if in_dto_class and not has_validation:
        findings.append(Finding("WARN", "DTO class missing validation decorators", str(filepath), dto_line))
    return findings


def check_vue_route_guards(filepath: Path, content: str) -> list[Finding]:
    """Find routes missing navigation guards."""
    findings = []
    if not re.search(r'(createRouter|new Router|routes)', content):
        return findings
    lines = content.splitlines()
    in_route = False
    route_line = 0
    has_auth_meta = False
    for i, line in enumerate(lines, 1):
        if re.search(r'(path\s*:|component\s*:)', line):
            if in_route and not has_auth_meta:
                findings.append(Finding("WARN", "Route missing meta.requiresAuth guard", str(filepath), route_line))
            in_route = True
            route_line = i
            has_auth_meta = False
        if in_route and re.search(r'requiresAuth', line):
            has_auth_meta = True
    if in_route and not has_auth_meta:
        findings.append(Finding("WARN", "Route missing meta.requiresAuth guard", str(filepath), route_line))
    return findings


def check_supabase_rls(filepath: Path, content: str) -> list[Finding]:
    """Find tables missing RLS policies in migration files."""
    findings = []
    tables_created = []
    tables_with_rls = set()
    lines = content.splitlines()
    for i, line in enumerate(lines, 1):
        match = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+\.)?(\w+)', line, re.IGNORECASE)
        if match:
            tables_created.append((match.group(2), i))
        rls_match = re.search(r'ALTER\s+TABLE\s+(?:\w+\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY', line, re.IGNORECASE)
        if rls_match:
            tables_with_rls.add(rls_match.group(1))
    for table_name, line_num in tables_created:
        if table_name not in tables_with_rls:
            findings.append(Finding("WARN", f"Table '{table_name}' missing RLS policy", str(filepath), line_num))
    return findings


# ---------------------------------------------------------------------------
# Main scanner
# ---------------------------------------------------------------------------

EXTENSION_CHECKERS = {
    ".ts": [check_ts_js, check_nestjs_guards, check_nestjs_dto_validation],
    ".js": [check_ts_js, check_nestjs_guards],
    ".vue": [check_vue, check_vue_route_guards],
    ".swift": [check_swift],
    ".sql": [check_sql, check_supabase_rls],
}


def scan_directory(directory: Path) -> list[Finding]:
    """Recursively scan directory for security issues."""
    all_findings: list[Finding] = []
    files_scanned = 0

    for root, _dirs, files in os.walk(directory):
        # Skip common non-source directories
        root_path = Path(root)
        if any(part.startswith(".") or part in ("node_modules", "dist", "build", "__pycache__", ".build")
               for part in root_path.parts):
            continue

        for filename in files:
            filepath = root_path / filename
            ext = filepath.suffix
            checkers = EXTENSION_CHECKERS.get(ext)
            if not checkers:
                continue

            files_scanned += 1
            try:
                content = filepath.read_text(encoding="utf-8", errors="ignore")
            except (OSError, PermissionError):
                continue

            for checker in checkers:
                all_findings.extend(checker(filepath, content))

    return all_findings


def generate_report(findings: list[Finding], directory: Path) -> Path:
    """Generate a Markdown security report."""
    now = datetime.now()
    report_name = f"{now.strftime('%y%m%d')}-security-report.md"
    report_dir = directory / "tasks" / "reviews"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / report_name

    blocks = [f for f in findings if f.severity == "BLOCK"]
    warns = [f for f in findings if f.severity == "WARN"]

    lines = [
        f"# Security Report — {now.strftime('%Y-%m-%d %H:%M')}",
        "",
        f"**Total issues:** {len(findings)} ({len(blocks)} BLOCK, {len(warns)} WARN)",
        "",
    ]

    if blocks:
        lines.append("## BLOCK Issues")
        lines.append("")
        for f in blocks:
            lines.append(f"- **{f.description}** at line {f.line} in `{f.file}`")
        lines.append("")

    if warns:
        lines.append("## WARN Issues")
        lines.append("")
        for f in warns:
            lines.append(f"- {f.description} at line {f.line} in `{f.file}`")
        lines.append("")

    if not findings:
        lines.append("No security issues found.")
        lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf-8")
    return report_path


def main() -> int:
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()

    if not directory.is_dir():
        print(f"Error: {directory} is not a directory")
        return 1

    print(f"Scanning {directory} ...")
    findings = scan_directory(directory)

    blocks = [f for f in findings if f.severity == "BLOCK"]
    warns = [f for f in findings if f.severity == "WARN"]

    # Print each finding
    for f in findings:
        print(f"{f.severity} — {f.description} at line {f.line} in {f.file}")

    # Generate report
    report_path = generate_report(findings, directory)
    print(f"\nReport written to {report_path}")

    # Count files scanned
    file_count = len({f.file for f in findings}) if findings else 0
    total_scanned = sum(
        1 for _ in directory.rglob("*")
        if _.suffix in EXTENSION_CHECKERS
        and not any(p.startswith(".") or p in ("node_modules", "dist", "build", "__pycache__", ".build") for p in _.parts)
    )

    print(f"\n{total_scanned} files scanned, {len(findings)} issues found ({len(blocks)} BLOCK, {len(warns)} WARN)")

    return 1 if blocks else 0


if __name__ == "__main__":
    sys.exit(main())
