# General Library Documentation Search

**Use when:** User asks about entire library/framework

**Speed:** Moderate (30-60s)
**Token usage:** Medium
**Accuracy:** Comprehensive

## Trigger Patterns

- "Documentation for [LIBRARY]"
- "[LIBRARY] getting started"
- "How to use [LIBRARY]"
- "[LIBRARY] API reference"

## Workflow (Script-First)

```bash
# STEP 1: Detect source + classify query
node scripts/detect-source.js "<user query>"
# Returns: {queryType: "LIBRARY_DOCS", source, library, repo, isTopicSpecific: false}

# STEP 2a: Context7 path
node scripts/fetch-context7.js "<user query>"
# Fetches general llms.txt (no ?topic= param)
# Returns: llms.txt with 5-20+ URLs

# STEP 3: Analyze llms.txt
echo '<llms.txt content>' | node scripts/analyze-results.js -
# Groups URLs: critical, important, supplementary
# Recommends: agent distribution strategy
# Returns: {totalUrls, grouped, distribution, budget}

# STEP 4: Deploy agents based on distribution
# - 1-3 URLs: Single agent or direct WebFetch
# - 4-10 URLs: Deploy 3-5 Explorer agents
# - 11+ URLs: Deploy 7 agents or phased approach

# STEP 5: Aggregate and present using output template
```

**If Context7 fails, try chub:**
```bash
# STEP 2b: Context Hub path
node scripts/fetch-chub.js "<library name>"
# Returns full curated documentation
```

## Agent Distribution

**1-3 URLs:** Single agent
**4-10 URLs:** 3-5 agents (2-3 URLs each)
**11-20 URLs:** 7 agents (balanced)
**21+ URLs:** Two-phase (critical first, then important)

## Context Budget

After all docs are gathered:
- Total ≤ 3000 tokens → inline in output template
- Total > 3000 tokens → write to `.claude/memory/docs-cache/` and return summary

## Fallback

Scripts handle fallback automatically:
1. `fetch-context7.js` tries context7.com URLs
2. If fails → `fetch-chub.js` tries Context Hub
3. If fails → WebFetch direct llms.txt from official site
4. If fails → WebSearch: "[library] official documentation"
