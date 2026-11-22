# Auto-Complexity Detection

AI auto-detects task complexity. User doesn't need `:fast` or `:hard` variants.

## Complexity Levels

The levels are the TRIVIAL, STANDARD and COMPLEX tiers defined in `references/model-selection-rules.md` (Task Complexity Tiers), with their size signals and approach.

## Auto-Detection Criteria

**TRIVIAL (1-2 tool calls):**
- Typo fix, single variable rename
- Add console.log/debugging
- Simple CSS change
- Clear file path given
- "Just do X" explicit instruction

**STANDARD (3-6 tool calls):**
- New component/function
- Bug fix with clear error
- API endpoint addition
- File modification with tests

**COMPLEX (7+ tool calls, use workflow-orchestrator):**
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
