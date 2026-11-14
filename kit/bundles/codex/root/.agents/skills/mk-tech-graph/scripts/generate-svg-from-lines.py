#!/usr/bin/env python3
"""Write newline-delimited SVG supplied on stdin to a validated output path."""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: generate-svg-from-lines.py <output.svg>", file=sys.stderr)
        return 2

    lines = sys.stdin.read().splitlines()
    if not lines:
        print("No SVG lines received on stdin.", file=sys.stderr)
        return 1

    content = "\n".join(lines) + "\n"
    if "<svg" not in content or "</svg>" not in content:
        print("SVG input must include opening and closing <svg> tags.", file=sys.stderr)
        return 1

    output = Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(content, encoding="utf-8")
    print(f"SVG written to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
