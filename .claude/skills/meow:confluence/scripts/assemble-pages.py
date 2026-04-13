#!/usr/bin/env python3
"""Deterministic multi-page markdown assembly for meow:confluence.

Usage:
    echo '<json>' | python3 assemble-pages.py

Input (JSON on stdin):
    {
        "main": {"title": "Page Title", "page_id": "12345", "space": "ENG", "url": "...", "content": "..."},
        "children": [{"title": "Child 1", "content": "..."}, ...],
        "comments": [{"author": "alice", "body": "..."}, ...],
        "attachments": [{"filename": "f.png", "size": "1.2MB", "mime": "image/png"}, ...]
    }

Output: Assembled markdown document with source metadata header.
"""

import json
import sys


def assemble(data: dict) -> str:
    main = data.get("main", {})
    children = data.get("children", [])
    comments = data.get("comments", [])
    attachments = data.get("attachments", [])

    lines = []
    lines.append("===CONFLUENCE_DATA_START===")
    lines.append("")
    lines.append(f"# {main.get('title', 'Untitled')}")
    lines.append("")
    lines.append(
        f"**Source:** Page ID: {main.get('page_id', '?')} "
        f"| Space: {main.get('space', '?')} "
        f"| URL: {main.get('url', '?')}"
    )
    lines.append("")

    # Main content
    lines.append("## Main Content")
    lines.append("")
    lines.append(main.get("content", "*No content*"))
    lines.append("")

    # Children
    if children:
        lines.append("## Child Pages")
        lines.append("")
        for child in children:
            lines.append(f"### {child.get('title', 'Untitled Child')}")
            lines.append("")
            lines.append(child.get("content", "*No content*"))
            lines.append("")

    # Comments
    if comments:
        lines.append("## Discussion (Comments)")
        lines.append("")
        for comment in comments:
            author = comment.get("author", "unknown")
            body = comment.get("body", "")
            lines.append(f"- **{author}:** {body}")
        lines.append("")

    # Attachments
    if attachments:
        lines.append("## Attachments")
        lines.append("")
        for att in attachments:
            name = att.get("filename", "unknown")
            size = att.get("size", "?")
            mime = att.get("mime", "?")
            lines.append(f"- {name} ({size}, {mime})")
        lines.append("")

    lines.append("===CONFLUENCE_DATA_END===")
    return "\n".join(lines)


if __name__ == "__main__":
    try:
        data = json.load(sys.stdin)
        print(assemble(data))
    except json.JSONDecodeError as e:
        print(f"Error: invalid JSON input — {e}", file=sys.stderr)
        sys.exit(1)
