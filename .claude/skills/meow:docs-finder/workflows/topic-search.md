# Topic-Specific Documentation Search

**Use when:** User asks about specific feature/component/concept

**Speed:** Fast (10-15s)
**Token usage:** Minimal
**Accuracy:** Highly targeted

## Trigger Patterns

- "How do I use [FEATURE] in [LIBRARY]?"
- "[LIBRARY] [COMPONENT] documentation"
- "Implement [FEATURE] with [LIBRARY]"
- "[LIBRARY] [CONCEPT] guide"

## Workflow (Script-First)

```bash
# STEP 1: Detect source + extract topic
node scripts/detect-source.js "<user query>"
# Returns: {queryType, source, library, repo, topic, isTopicSpecific: true}

# STEP 2a: If source=context7 — fetch via Context7
node scripts/fetch-context7.js "<user query>"
# Script constructs: context7.com/{repo}/llms.txt?topic={topic}
# Returns: {success, content, tokenEstimate, topicSpecific: true}

# STEP 2b: If source=chub — fetch via Context Hub
node scripts/fetch-chub.js "<user query>" --lang <detected>
# Returns: {success, content, lang, hasAnnotations}

# STEP 3: Analyze results + check context budget
echo '<content>' | node scripts/analyze-results.js -
# Returns: {budget: {withinBudget, action}, hasCodeExamples}

# STEP 4: If budget.action = "inline" → return in template
#         If budget.action = "write-to-file" → save + summarize
```

## Examples

**shadcn date picker:**
```bash
node scripts/detect-source.js "How do I use date picker in shadcn/ui?"
# {source: "context7", library: "shadcn/ui", repo: "shadcn-ui/ui", topic: "date"}

node scripts/fetch-context7.js "How do I use date picker in shadcn/ui?"
# Fetches: context7.com/shadcn-ui/ui/llms.txt?topic=date
# Returns: 2-3 date-specific URLs → fetch with WebFetch
```

**Stripe Python webhooks:**
```bash
node scripts/detect-source.js "Stripe webhook verification Python"
# {source: "context7", library: "stripe", repo: "stripe/stripe-node", topic: "webhook"}

node scripts/fetch-chub.js "stripe webhooks" --lang py
# Returns: Python-specific webhook docs with annotations
```

## Benefits

- 10x faster than full library docs
- No filtering needed — topic-scoped at source
- Minimal context usage
- Language-specific when using chub

## Fallback

If topic URL returns 404 or empty:
→ Fallback to [General Library Search](./library-search.md)
