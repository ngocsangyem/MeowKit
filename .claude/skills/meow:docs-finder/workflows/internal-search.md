# Internal / Project Documentation Search

**Use when:** User asks about internal project docs, specs, or conventions

**Speed:** Fast (5-15s)
**Token usage:** Low
**Accuracy:** Project-specific

## Trigger Patterns

- "Find our API auth spec"
- "Where is the internal [X] documentation?"
- "Our project's [convention/pattern] docs"
- "Team documentation for [feature]"

## Workflow

```bash
# STEP 1: Detect source
node scripts/detect-source.js "<user query>"
# Returns: {queryType: "INTERNAL_DOCS", source: "chub", fallbackSource: "local"}

# STEP 2a: If chub is available
node scripts/fetch-chub.js "<query keywords>"
# chub may have project-specific docs if indexed
# Returns: {success, content} or {success: false}

# STEP 2b: If chub unavailable or no results → local project search
# Use Grep/Glob to search within project:
#   Grep: docs/ README.md for query keywords
#   Glob: docs/**/*.md, *.spec.md, *.design.md
#   Read matched files

# STEP 3: Analyze results
echo '<content>' | node scripts/analyze-results.js -
# Checks context budget

# STEP 4: Format using output template
# Source: "Project local" or "Context Hub"
# Confidence: HIGH (project docs found) or LOW (no docs found)
```

## Local Search Strategy

When neither chub nor MCP has the internal docs:

1. **Grep docs/ directory** for keywords from the query
2. **Glob for spec/design files:** `docs/**/*auth*.md`, `docs/**/*api*.md`
3. **Check README.md** root for architecture section

## Context Budget

Internal docs are often long specifications:
- ≤ 3000 tokens → inline
- \> 3000 tokens → save to `.claude/memory/docs-cache/project-{topic}.md`, return summary

## Fallback

If no internal docs found:
1. Report: "No internal documentation found for [topic]"
2. Suggest: "Consider creating docs/[topic].md"
3. Offer: "Want me to search for external [library] docs instead?"
