# Recursive Delegation

> Source: https://contextpatterns.com/patterns/recursive-delegation/

Let agents spawn child agents with scoped sub-contexts. Instead of stuffing everything into one window, the parent splits work, delegates with focused context, and aggregates results.

[Zhang et al. (2025): Recursive Language Models](https://arxiv.org/abs/2512.24601)

## The Problem This Solves

Some tasks require processing more information than any single context window can hold: analyzing an entire codebase, researching across hundreds of documents, synthesizing data from multiple large sources. Even with [Isolate](isolate.md), someone has to decide how to split the work and what each sub-agent gets, and if the orchestrator makes that decision upfront it needs to understand the full scope, which may itself exceed its effective context.

## How It Works

Give the top-level agent the ability to spawn child agents, each with their own context windows, and critically let those child agents do the same: spawn their own children with further-scoped contexts. The decomposition happens recursively based on what each agent discovers, not based on a static upfront plan.

**The recursion:**

1.  **Parent agent** receives a high-level task and an overview of available information.
2.  Parent **decomposes** the task into subtasks, deciding what scope of information each subtask needs.
3.  Parent **spawns child agents**, each with a focused brief and relevant context subset.
4.  Each child either completes its task or further decomposes and delegates.
5.  Results **flow back up** the tree. Each parent summarizes and integrates its children’s outputs.

The context at every node in the tree stays focused and manageable, while the total information processed across the entire tree can be orders of magnitude larger than any single window.

## Example

Task: “Audit this 500-file codebase for security vulnerabilities.”

A single agent would need to read all 500 files, and even with progressive disclosure it would lose track of patterns across files as its context fills up.

With recursive delegation:

- **Root agent** receives the file tree and README. Identifies major subsystems (auth, API, database, file handling, third-party integrations).
- **Spawns 5 child agents**, one per subsystem. Each receives its subset of files plus relevant security context (OWASP top 10 for its domain).
- The **auth child** finds the subsystem is large. It spawns its own children: one for JWT handling, one for OAuth, one for session management.
- Results aggregate upward: each leaf agent reports findings, parents synthesize cross-cutting concerns, root produces the final audit.

No single agent in the tree ever holds more than 20-30 files in context. The full 500-file codebase is covered.

**Pseudocode for the pattern:**

```
def audit_security(file_tree, context, max_files=25, depth=0, max_depth=3):
    """
    Recursively audit security across a file tree.
    Each agent spawns children if scope exceeds max_files.
    """

    # Base case: small enough to handle directly
    if len(file_tree.files) <= max_files or depth >= max_depth:
        return audit_files_directly(file_tree.files, context)

    # Recursive case: decompose and delegate
    subsystems = identify_subsystems(file_tree)
    child_results = []

    for subsystem in subsystems:
        child_context = build_context_for(subsystem, context)
        child_result = spawn_agent(
            task=audit_security,
            file_tree=subsystem.files,
            context=child_context,
            max_files=max_files,
            depth=depth + 1,
            max_depth=max_depth
        )
        child_results.append(child_result)

    # Aggregate results from children
    return synthesize_findings(child_results, subsystems)
```

Each call operates on a manageable context. The tree depth adapts to the codebase structure. Total coverage scales without individual context bloat.

## Requirements

This pattern requires infrastructure that most simple agent setups don’t have:

- **Agent spawning.** The ability for one agent to create another with a controlled context.
- **Code execution.** The parent needs to programmatically assemble each child’s context rather than manually specifying it.
- **Result aggregation.** A protocol for children to return structured results to parents.
- **Depth limits.** Without bounds, recursive delegation can create unnecessarily deep trees. Set a maximum depth and fall back to sequential processing at the leaves.

## When to Use

- Tasks that exceed any single agent’s effective context capacity
- Work that decomposes naturally into a hierarchy (codebases, document collections, organizational structures)
- When the decomposition itself requires understanding the content (you can’t plan the split without reading)

## When Not to Use

- Tasks a single agent handles comfortably (the orchestration overhead isn’t worth it)
- When subtasks have heavy interdependencies (the tree structure assumes relative independence)
- When latency matters more than thoroughness (recursive delegation is slow; each level adds round-trip time)

## Related Patterns

- **[Isolate](isolate.md)** is the single-level version of this pattern
- **[Compress & Restart](core/compress.md)** is what happens at each node when its context grows too large
