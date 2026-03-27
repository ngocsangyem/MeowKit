# Error Handling & Fallback Strategies

## Error Codes

### Context7 Errors

**404 Not Found**
- Topic-specific URL not available
- Library not indexed on context7.com
- llms.txt doesn't exist at that path

**Timeout (>30s)**
- Network issues
- context7.com under load
- Large llms.txt response

**Invalid Response**
- Malformed llms.txt
- Empty content
- HTML returned instead of text

### Context Hub (chub) Errors

**npx chub unavailable**
- Network issue (npx needs to download the package)
- npm/npx not installed

**No results**
- Library not in the community registry
- Search terms too specific

**Network error (during chub update)**
- CDN unavailable
- Rate limited

**Empty doc content**
- Doc ID exists but content not yet submitted
- Language variant not available

## Fallback Chain

### For Library Documentation

```
1. Context7 MCP (if configured)
   → mcp__context7__resolve-library-id + get-library-docs
   ↓ fails
2. Context7 script (direct HTTP)
   → node scripts/fetch-context7.js "<query>"
   ↓ fails
3. Context Hub CLI (if installed)
   → node scripts/fetch-chub.js "<query>"
   ↓ fails
4. Direct llms.txt fetch
   → WebFetch: {library-domain}/llms.txt
   ↓ 404
5. Web search
   → WebSearch: "[library] llms.txt"
   → WebSearch: "[library] official documentation [topic]"
```

### For Internal/Project Documentation

```
1. Context Hub (if installed)
   → chub search [query]
   ↓ no results
2. Local project search
   → Grep: docs/ README API spec
   ↓ no matches
3. Report not found with suggestions
```

## Recovery Actions by Error Type

| Error | Action | Message to User |
|-------|--------|----------------|
| Context7 404 | Try chub → fallback chain | "Not on context7, trying alternatives..." |
| chub not installed | Skip to Context7/web | "chub not installed. Using web sources." |
| Network timeout | Skip to next source | "Timed out. Trying alternative..." |
| All sources empty | Report failure + manual options | "Could not find docs. Try: [manual steps]" |
| Rate limited | Use API key if available | "Rate limited. Set CONTEXT7_API_KEY in .env" |

## Context Budget Overflow

When retrieved docs exceed 3000 tokens (inline budget):
1. Write full docs to `.claude/memory/docs-cache/{library}-{topic}.md`
2. Return 500-token summary inline
3. Include file path for the agent to read sections as needed
