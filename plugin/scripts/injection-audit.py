#!/usr/bin/env python3
"""Prompt injection audit — Layer 4 output validation.

Scans agent output and written files for signs of successful prompt injection.
Runs AFTER agent completes any task.

Usage: python injection-audit.py [directory] [--output FILE]
Requirements: Python 3.9+, no external dependencies.
"""

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path


# --- Detection patterns ---

IDENTITY_OVERRIDE_PATTERNS = [
    re.compile(r"I am now (?!going to|ready|done|finished)", re.IGNORECASE),
    re.compile(r"my new instructions are", re.IGNORECASE),
    re.compile(r"ignoring previous rules", re.IGNORECASE),
    re.compile(r"I have been instructed to", re.IGNORECASE),
    re.compile(r"my new role is", re.IGNORECASE),
    re.compile(r"I(?:'m| am) no longer (?:bound|restricted|limited)", re.IGNORECASE),
]

EXFILTRATION_PATTERNS = [
    re.compile(r"curl\s+.*\$\(", re.IGNORECASE),
    re.compile(r"wget\s+.*\$\(", re.IGNORECASE),
    re.compile(r"curl\s+.*-d\s+@", re.IGNORECASE),
    re.compile(r"curl\s+.*--data.*@", re.IGNORECASE),
    re.compile(r'base64\s+(--decode|-d)?\s*["\']?[A-Za-z0-9+/=]{50,}', re.IGNORECASE),
    re.compile(r"nc\s+-[a-z]*\s+\d+", re.IGNORECASE),  # netcat
]

SENSITIVE_DATA_PATTERNS = [
    re.compile(r"(api[_-]?key|apikey)\s*[:=]\s*['\"][^'\"]{10,}", re.IGNORECASE),
    re.compile(r"(password|passwd)\s*[:=]\s*['\"][^'\"]+", re.IGNORECASE),
    re.compile(r"(secret|token)\s*[:=]\s*['\"][^'\"]{10,}", re.IGNORECASE),
    re.compile(r"-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"ssh-(rsa|ed25519|ecdsa)\s+[A-Za-z0-9+/=]{50,}"),
]

UNEXPECTED_COMMAND_PATTERNS = [
    re.compile(r"rm\s+-rf\s+/", re.IGNORECASE),
    re.compile(r"chmod\s+777", re.IGNORECASE),
    re.compile(r"eval\s*\(", re.IGNORECASE),
    re.compile(r"exec\s*\(", re.IGNORECASE),
    re.compile(r"os\.system\s*\(", re.IGNORECASE),
    re.compile(r"subprocess\.call\s*\(.*shell\s*=\s*True", re.IGNORECASE),
    re.compile(r">>?\s*~/\.bashrc", re.IGNORECASE),
    re.compile(r">>?\s*~/\.zshrc", re.IGNORECASE),
]


class Finding:
    """A single audit finding."""

    def __init__(self, level: str, category: str, description: str, file: str, line: int = 0):
        self.level = level  # CLEAN, SUSPICIOUS, CRITICAL
        self.category = category
        self.description = description
        self.file = file
        self.line = line

    def __str__(self) -> str:
        loc = f" (line {self.line})" if self.line else ""
        return f"[{self.level}] [{self.category}] {self.description} — {self.file}{loc}"


def scan_content(content: str, filepath: str) -> list[Finding]:
    """Scan text content for injection indicators."""
    findings: list[Finding] = []
    lines = content.splitlines()

    for i, line in enumerate(lines, 1):
        # Identity override
        for pat in IDENTITY_OVERRIDE_PATTERNS:
            if pat.search(line):
                findings.append(Finding(
                    "CRITICAL", "IDENTITY_OVERRIDE",
                    f"Agent identity may have been overridden: {pat.pattern}",
                    filepath, i
                ))

        # Exfiltration
        for pat in EXFILTRATION_PATTERNS:
            if pat.search(line):
                findings.append(Finding(
                    "CRITICAL", "EXFILTRATION",
                    f"Potential data exfiltration pattern: {pat.pattern}",
                    filepath, i
                ))

        # Sensitive data exposure
        for pat in SENSITIVE_DATA_PATTERNS:
            if pat.search(line):
                findings.append(Finding(
                    "SUSPICIOUS", "SENSITIVE_DATA",
                    f"Sensitive data pattern detected: {pat.pattern}",
                    filepath, i
                ))

        # Unexpected commands
        for pat in UNEXPECTED_COMMAND_PATTERNS:
            if pat.search(line):
                findings.append(Finding(
                    "SUSPICIOUS", "UNEXPECTED_COMMAND",
                    f"Unexpected system command: {pat.pattern}",
                    filepath, i
                ))

    return findings


def scan_file(filepath: Path) -> list[Finding]:
    """Scan a single file."""
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except (OSError, PermissionError):
        return []
    return scan_content(content, str(filepath))


def check_file_outside_project(filepath: Path, project_root: Path) -> Finding | None:
    """Check if a file was written outside the project directory."""
    try:
        filepath.resolve().relative_to(project_root.resolve())
        return None
    except ValueError:
        return Finding(
            "CRITICAL", "BOUNDARY_VIOLATION",
            f"File written outside project directory",
            str(filepath)
        )


def scan_directory(directory: Path) -> list[Finding]:
    """Scan recently modified files in directory."""
    findings: list[Finding] = []
    skip_dirs = {".git", "node_modules", "dist", "build", "__pycache__", ".build", ".claude"}

    for root, dirs, files in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            fpath = Path(root) / fname
            # Only scan text-like files
            if fpath.suffix in {
                ".ts", ".js", ".tsx", ".jsx", ".py", ".swift",
                ".vue", ".md", ".txt", ".sh", ".sql", ".json",
                ".yaml", ".yml", ".toml", ".env", ".cfg", ".ini",
            }:
                findings.extend(scan_file(fpath))

    return findings


def write_security_log(findings: list[Finding], log_path: Path, command: str = "unknown") -> None:
    """Append CRITICAL findings to security log."""
    critical = [f for f in findings if f.level == "CRITICAL"]
    if not critical:
        return

    timestamp = datetime.now().strftime("%y%m%d-%H%M%S")
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            for finding in critical:
                f.write(f"[{timestamp}] [{finding.level}] [{command}] {finding.description} — {finding.file}\n")
    except OSError:
        pass  # Log failure shouldn't break the audit


def main() -> int:
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()

    if not directory.is_dir():
        print(f"Error: {directory} is not a directory")
        return 1

    # Determine command context from env or args
    command = os.environ.get("MEOWKIT_COMMAND", "manual-audit")

    print(f"Injection audit scanning: {directory}")
    findings = scan_directory(directory)

    critical = [f for f in findings if f.level == "CRITICAL"]
    suspicious = [f for f in findings if f.level == "SUSPICIOUS"]

    # Print findings
    for f in findings:
        print(str(f))

    # Summary
    print(f"\n--- Audit Summary ---")
    print(f"CRITICAL: {len(critical)}")
    print(f"SUSPICIOUS: {len(suspicious)}")

    if critical:
        print("\n==== CRITICAL — Possible successful prompt injection ====")
        print("HALT: Review findings above. Do NOT proceed without human review.")

        # Write to security log
        log_path = directory / ".claude" / "memory" / "security-log.md"
        write_security_log(critical, log_path, command)
        print(f"Findings logged to: {log_path}")

        return 1

    if suspicious:
        print("\n==== SUSPICIOUS — Review recommended ====")
        print("Findings may be false positives. User review recommended.")
        return 0

    print("\nCLEAN — no injection indicators found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
