#!/usr/bin/env python3
"""Dependency graph builder + cycle detector for meow:planning-engine.

Usage:
    echo '<json>' | python3 dep-graph.py

Input (JSON array on stdin):
    [
        {"key": "PROJ-1", "blocks": ["PROJ-2"], "blocked_by": []},
        {"key": "PROJ-2", "blocks": [], "blocked_by": ["PROJ-1"]},
        {"key": "PROJ-3", "blocks": ["PROJ-1"], "blocked_by": ["PROJ-2"]}
    ]

Output (JSON on stdout):
    {
        "adjacency": {"PROJ-1": {"blocks": ["PROJ-2"], "blocked_by": []}, ...},
        "critical_path": ["PROJ-1", "PROJ-2", "PROJ-3"],
        "cycles": [["PROJ-1", "PROJ-2", "PROJ-3", "PROJ-1"]],
        "orphans": ["PROJ-4"]
    }
"""

import json
import sys
from collections import defaultdict


def build_graph(tickets: list[dict]) -> dict:
    """Build adjacency dict from ticket list."""
    adj = {}
    all_keys = set()
    for t in tickets:
        key = t["key"]
        all_keys.add(key)
        adj[key] = {
            "blocks": t.get("blocks", []),
            "blocked_by": t.get("blocked_by", []),
        }
        all_keys.update(t.get("blocks", []))
        all_keys.update(t.get("blocked_by", []))

    # Add missing keys as orphans
    for k in all_keys:
        if k not in adj:
            adj[k] = {"blocks": [], "blocked_by": []}

    return adj


def detect_cycles(adj: dict) -> list[list[str]]:
    """Detect cycles using DFS coloring."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {k: WHITE for k in adj}
    parent = {k: None for k in adj}
    cycles = []

    def dfs(node: str, path: list[str]):
        color[node] = GRAY
        path.append(node)
        for neighbor in adj[node]["blocks"]:
            if neighbor not in color:
                continue
            if color[neighbor] == GRAY:
                # Found cycle — extract it
                cycle_start = path.index(neighbor)
                cycle = path[cycle_start:] + [neighbor]
                cycles.append(cycle)
            elif color[neighbor] == WHITE:
                parent[neighbor] = node
                dfs(neighbor, path)
        path.pop()
        color[node] = BLACK

    for node in adj:
        if color[node] == WHITE:
            dfs(node, [])

    return cycles


def find_critical_path(adj: dict, cycles: list) -> list[str]:
    """Find longest dependency chain (topological order). Skip if cycles exist."""
    if cycles:
        return []

    # Topological sort via Kahn's algorithm
    in_degree = defaultdict(int)
    for k in adj:
        in_degree.setdefault(k, 0)
        for b in adj[k]["blocks"]:
            in_degree[b] += 1

    queue = [k for k in adj if in_degree[k] == 0]
    order = []
    while queue:
        queue.sort()  # deterministic ordering
        node = queue.pop(0)
        order.append(node)
        for neighbor in adj[node]["blocks"]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return order


def find_orphans(adj: dict) -> list[str]:
    """Find tickets with no links at all."""
    return sorted(
        k for k, v in adj.items()
        if not v["blocks"] and not v["blocked_by"]
    )


def main():
    try:
        tickets = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    adj = build_graph(tickets)
    cycles = detect_cycles(adj)
    critical_path = find_critical_path(adj, cycles)
    orphans = find_orphans(adj)

    result = {
        "adjacency": adj,
        "critical_path": critical_path,
        "cycles": cycles,
        "orphans": orphans,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
