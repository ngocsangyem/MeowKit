#!/usr/bin/env python3
"""Sprint capacity bin-packing for meow:planning-engine.

Usage:
    echo '<json>' | python3 capacity-bin.py

Input (JSON on stdin):
    {
        "tickets": [
            {"key": "PROJ-1", "points": 5, "summary": "OAuth login"},
            {"key": "PROJ-2", "points": 8, "summary": "Session refresh"},
            {"key": "PROJ-3", "points": null, "summary": "Unestimated ticket"}
        ],
        "capacity": 40
    }

Output (JSON on stdout):
    {
        "capacity": 40,
        "fits": [{"key": "PROJ-1", "points": 5}, ...],
        "overflow": [...],
        "unestimated": [{"key": "PROJ-3", "summary": "..."}],
        "total_estimated_points": 13,
        "estimated_count": 2,
        "total_count": 3,
        "incomplete": true,
        "remaining_capacity": 27
    }
"""

import json
import sys


def bin_pack(data: dict) -> dict:
    tickets = data.get("tickets", [])
    capacity = data.get("capacity", 0)

    estimated = []
    unestimated = []

    for t in tickets:
        points = t.get("points")
        if points is None or points == 0:
            unestimated.append({
                "key": t["key"],
                "summary": t.get("summary", ""),
            })
        else:
            estimated.append({
                "key": t["key"],
                "points": points,
                "summary": t.get("summary", ""),
            })

    # Sort by points descending (largest first bin-packing)
    estimated.sort(key=lambda x: x["points"], reverse=True)

    fits = []
    overflow = []
    running_total = 0

    for t in estimated:
        if running_total + t["points"] <= capacity:
            fits.append(t)
            running_total += t["points"]
        else:
            overflow.append(t)

    total_estimated = sum(t["points"] for t in estimated)
    incomplete = len(unestimated) / max(len(tickets), 1) > 0.3

    return {
        "capacity": capacity,
        "fits": fits,
        "overflow": overflow,
        "unestimated": unestimated,
        "total_estimated_points": total_estimated,
        "estimated_count": len(estimated),
        "total_count": len(tickets),
        "incomplete": incomplete,
        "remaining_capacity": capacity - running_total,
    }


if __name__ == "__main__":
    try:
        data = json.load(sys.stdin)
        result = bin_pack(data)
        print(json.dumps(result, indent=2))
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)
