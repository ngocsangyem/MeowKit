# Auto-Complexity Detection

AI auto-detects task complexity. User doesn't need `:fast` or `:hard` variants.

## Complexity Levels

```toon
complexity[3]{level,criteria,approach}:
  Quick,Single file/Simple fix/Clear scope,Direct implementation - skip research
  Standard,2-5 files/Feature add/Some unknowns,Scout first then implement
  Deep,6+ files/Architecture/Vague scope,Research + plan + implement
```

## Auto-Detection Criteria

**Quick (1-2 tool calls):**
- Typo fix, single variable rename
- Add console.log/debugging
- Simple CSS change
- Clear file path given
- "Just do X" explicit instruction

**Standard (3-6 tool calls):**
- New component/function
- Bug fix with clear error
- API endpoint addition
- File modification with tests

**Deep (7+ tool calls, use workflow-orchestrator):**
- New feature across multiple files
- Refactoring/architecture change
- Vague requirements ("make this better")
- Security audit
- Performance optimization
- User asks to "plan" or "design"

## Detection Logic

```
1. Count mentioned files/components
2. Check for vague vs specific language
3. Detect scope modifiers (all, entire, every)
4. Check for research keywords (how, why, best way)
5. Assign complexity level
```
