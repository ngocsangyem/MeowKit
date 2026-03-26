#!/usr/bin/env python3
"""Generate llms.txt from a docs directory following llmstxt.org specification.

Offloads deterministic work (file scanning, title extraction, categorization)
so Claude only needs to review and improve the generated output.

Usage:
  python3 generate-llms-txt.py --source <path> [--output <path>] [--base-url <url>] [--full]
  python3 generate-llms-txt.py --source ./docs --base-url https://example.com/docs
  python3 generate-llms-txt.py --source ./docs --output ./public --full

Adapted from claudekit-engineer/llms/scripts/generate-llms-txt.py for MeowKit.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path


def extract_title(content: str, filepath: Path) -> str:
    """Extract H1 title from markdown content, fallback to filename."""
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return filepath.stem.replace("-", " ").replace("_", " ").title()


def extract_description(content: str) -> str:
    """Extract first meaningful paragraph after H1 as description."""
    lines = content.split("\n")
    found_h1 = False
    paragraph_lines = []

    for line in lines:
        stripped = line.strip()
        if not found_h1:
            if stripped.startswith("# "):
                found_h1 = True
            continue
        if not stripped:
            if paragraph_lines:
                break
            continue
        if stripped.startswith("#") or stripped.startswith("---"):
            if paragraph_lines:
                break
            continue
        if stripped.startswith(">"):
            paragraph_lines.append(stripped.lstrip("> ").strip())
            continue
        if stripped.startswith("- ") or stripped.startswith("* "):
            if paragraph_lines:
                break
            continue
        paragraph_lines.append(stripped)

    desc = " ".join(paragraph_lines)
    if len(desc) > 150:
        desc = desc[:147].rsplit(" ", 1)[0] + "..."
    return desc


def categorize_file(filepath: Path) -> str:
    """Categorize a doc file into a section based on path/name heuristics."""
    parts = [p.lower() for p in filepath.parts]
    name = filepath.stem.lower()

    category_map = {
        "api": "API Reference",
        "api-reference": "API Reference",
        "reference": "API Reference",
        "guide": "Guides",
        "guides": "Guides",
        "tutorial": "Guides",
        "tutorials": "Guides",
        "getting-started": "Getting Started",
        "quickstart": "Getting Started",
        "quick-start": "Getting Started",
        "setup": "Getting Started",
        "installation": "Getting Started",
        "install": "Getting Started",
        "config": "Configuration",
        "configuration": "Configuration",
        "settings": "Configuration",
        "architecture": "Architecture",
        "design": "Architecture",
        "faq": "Optional",
        "changelog": "Optional",
        "contributing": "Optional",
        "migration": "Optional",
        "troubleshooting": "Optional",
    }

    for part in parts + [name]:
        if part in category_map:
            return category_map[part]

    return "Documentation"


def scan_docs(source: Path) -> list:
    """Scan directory for markdown files and extract metadata."""
    docs = []
    extensions = {".md", ".mdx"}

    for filepath in sorted(source.rglob("*")):
        if filepath.suffix not in extensions:
            continue
        if filepath.name.startswith("."):
            continue
        if any(p.startswith(".") or p in ("node_modules", "dist", "build", "__pycache__", ".venv")
               for p in filepath.parts):
            continue

        try:
            content = filepath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        title = extract_title(content, filepath)
        description = extract_description(content)
        category = categorize_file(filepath.relative_to(source))
        rel_path = filepath.relative_to(source)

        docs.append({
            "title": title,
            "description": description,
            "category": category,
            "rel_path": str(rel_path),
            "content": content,
        })

    return docs


def build_url(rel_path: str, base_url: str) -> str:
    """Build full URL from relative path and base URL."""
    if not base_url:
        return rel_path
    base = base_url.rstrip("/")
    clean_path = re.sub(r"\.(md|mdx)$", "", rel_path)
    return f"{base}/{clean_path}"


def generate_llms_txt(docs: list, project_name: str, project_desc: str, base_url: str) -> str:
    """Generate llms.txt content from scanned docs."""
    lines = [f"# {project_name}", ""]

    if project_desc:
        lines.append(f"> {project_desc}")
        lines.append("")

    categories = {}
    for doc in docs:
        categories.setdefault(doc["category"], []).append(doc)

    priority = {"Getting Started": 0, "Documentation": 5, "Optional": 99}
    sorted_cats = sorted(categories.keys(), key=lambda c: (priority.get(c, 10), c))

    for cat in sorted_cats:
        lines.append(f"## {cat}")
        lines.append("")
        for doc in categories[cat]:
            url = build_url(doc["rel_path"], base_url)
            desc_part = f": {doc['description']}" if doc["description"] else ""
            lines.append(f"- [{doc['title']}]({url}){desc_part}")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def generate_llms_full_txt(docs: list, project_name: str, project_desc: str) -> str:
    """Generate llms-full.txt with inline content."""
    lines = [f"# {project_name}", ""]

    if project_desc:
        lines.append(f"> {project_desc}")
        lines.append("")

    categories = {}
    for doc in docs:
        categories.setdefault(doc["category"], []).append(doc)

    priority = {"Getting Started": 0, "Documentation": 5, "Optional": 99}
    sorted_cats = sorted(categories.keys(), key=lambda c: (priority.get(c, 10), c))

    for cat in sorted_cats:
        lines.append(f"## {cat}")
        lines.append("")
        for doc in categories[cat]:
            lines.append(f"### {doc['title']}")
            lines.append("")
            content = doc["content"]
            content = re.sub(r"^---\s*\n.*?\n---\s*\n", "", content, flags=re.DOTALL)
            content = re.sub(r"^#\s+.+\n*", "", content)
            lines.append(content.strip())
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def detect_project_info(source: Path) -> tuple:
    """Try to detect project name and description from common files."""
    name = source.resolve().name
    desc = ""

    # Check package.json
    for pkg_path in [source / "package.json", source.parent / "package.json"]:
        if pkg_path.exists():
            try:
                import json
                data = json.loads(pkg_path.read_text(encoding="utf-8"))
                name = data.get("name", name)
                desc = data.get("description", desc)
            except (OSError, json.JSONDecodeError):
                pass
            break

    # Check README
    for readme_name in ["README.md", "readme.md", "Readme.md"]:
        for readme_path in [source / readme_name, source.parent / readme_name]:
            if readme_path.exists():
                try:
                    content = readme_path.read_text(encoding="utf-8")
                    h1 = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
                    if h1:
                        name = h1.group(1).strip()
                    if not desc:
                        desc = extract_description(content)
                except OSError:
                    pass
                break

    return name, desc


def main():
    parser = argparse.ArgumentParser(description="Generate llms.txt from docs directory")
    parser.add_argument("--source", required=True, help="Path to docs directory")
    parser.add_argument("--output", default=".", help="Output directory (default: cwd)")
    parser.add_argument("--base-url", default="", help="Base URL prefix for links")
    parser.add_argument("--full", action="store_true", help="Also generate llms-full.txt")
    parser.add_argument("--project-name", default="", help="Project name (auto-detected)")
    parser.add_argument("--project-description", default="", help="Project description (auto-detected)")
    parser.add_argument("--json", action="store_true", help="Output metadata as JSON (for Claude to review)")

    args = parser.parse_args()
    source = Path(args.source).resolve()

    if not source.is_dir():
        print(f"Error: '{source}' is not a directory", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    auto_name, auto_desc = detect_project_info(source)
    project_name = args.project_name or auto_name
    project_desc = args.project_description or auto_desc

    docs = scan_docs(source)
    if not docs:
        print(f"No markdown files found in '{source}'", file=sys.stderr)
        sys.exit(1)

    # JSON mode — output metadata for Claude to review
    if args.json:
        meta = {
            "project_name": project_name,
            "project_description": project_desc,
            "files_found": len(docs),
            "categories": {},
        }
        for doc in docs:
            cat = doc["category"]
            meta["categories"].setdefault(cat, []).append({
                "title": doc["title"],
                "description": doc["description"],
                "path": doc["rel_path"],
            })
        print(json.dumps(meta, indent=2))
        sys.exit(0)

    # Generate llms.txt
    llms_txt = generate_llms_txt(docs, project_name, project_desc, args.base_url)
    llms_path = output_dir / "llms.txt"
    llms_path.write_text(llms_txt, encoding="utf-8")
    print(f"Generated: {llms_path} ({len(docs)} files indexed)")

    # Generate llms-full.txt
    if args.full:
        llms_full = generate_llms_full_txt(docs, project_name, project_desc)
        full_path = output_dir / "llms-full.txt"
        full_path.write_text(llms_full, encoding="utf-8")
        print(f"Generated: {full_path}")

    print("Done!")


if __name__ == "__main__":
    main()
