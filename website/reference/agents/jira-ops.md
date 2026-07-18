---
title: jira-ops
description: Jira operations agent — manages jira-as cache, validates connectivity, and discovers project context. Diagnostic-only, no Atlassian state changes.
---

# jira-ops

The jira-ops agent handles the operational layer of the Jira integration — cache management, connectivity validation, and project context discovery. It is diagnostic-only: it inspects and maintains the `jira-as` CLI wrapper's local state but never modifies anything in the Jira instance itself.

## Cognitive Framing

> *"Healthy plumbing makes everything faster. Cache hits prevent unnecessary API calls."*

The jira-ops agent maintains the infrastructure that all other Jira agents depend on. When the `jira-as` cache is stale, every Jira operation is slower. When project context is not discovered, every agent has to re-learn custom fields and workflows. The jira-ops agent keeps this foundation healthy.

## Key Facts

| | |
|---|---|
| **Type** | Domain (Jira) |
| **Phase** | On-demand |
| **Model** | haiku |
| **Color** | gray |
| **Safety** | Diagnostic-only — no Atlassian state changes |
| **Never does** | Modify Jira state, issue CRUD (jira-issue), project administration (jira-admin) |

## When to Use

- When you need to **check cache status** — is the local cache fresh or stale?
- When you need to **clear the cache** to force re-fetching from Jira.
- When you need to **discover project context** — custom fields, workflows, and configuration for a project.
- When troubleshooting **Jira connectivity or authentication issues**.

## Key Capabilities

- **Cache status** — reports whether the `jira-as` cache is fresh or stale, with age information.
- **Cache clearing** — clears the local cache to force fresh data retrieval from Jira.
- **Project context discovery** — discovers and caches project-specific context: custom fields, workflows, issue types, and configuration.
- **Connectivity validation** — tests connectivity to the Jira instance and reports authentication status.

## Behavioral Checklist

- [x] Reports cache freshness with age information
- [x] Clears cache safely without affecting Jira state
- [x] Discovers and caches project context for other agents
- [x] Validates connectivity and authentication status
- [x] Never modifies Jira state — diagnostic only

## Common Use Cases

| Scenario | What the agent does |
|---|---|
| "Jira cache status" | Reports cache freshness, age, and size |
| "Clear jira cache" | Clears local cache, forcing next operation to fetch fresh data |
| "Discover project context for PROJ" | Discovers custom fields, workflows, and configuration for the project |
| "Is Jira connected?" | Tests connectivity and reports authentication status |

## Pro Tips

### Clear Cache When Jira Config Changes

If your Jira admin changes workflows, custom fields, or project configuration, the local cache becomes stale. Clearing the cache ensures all agents work with current data rather than cached assumptions.

### Discover Context for New Projects

When starting work with a new Jira project, running project context discovery populates the cache with custom field IDs, workflow states, and configuration — making subsequent agent operations faster and more accurate.

## Key Takeaway

The jira-ops agent maintains the operational health of the Jira integration by keeping the local cache fresh and project context discovered. As a diagnostic-only agent, it provides the visibility needed to troubleshoot issues without risk of modifying Jira state.

## Related Agents

- **[jira-fields](/reference/agents/jira-fields)** — discovers specific field IDs (jira-ops discovers broader project context)
- **[jira-lifecycle](/reference/agents/jira-lifecycle)** — uses cached workflow data maintained by jira-ops
- **[jira-admin](/reference/agents/jira-admin)** — handles Jira administration that may invalidate the ops cache
