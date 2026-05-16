# Tool Descriptions as Context

> Source: https://contextpatterns.com/patterns/tool-descriptions/

Tool definitions are context. The description tells the model when to use a tool and how. Most descriptions only say what the tool does; the ones that work also say when to use it and when not to.

[Anthropic: Tool Use Documentation](https://docs.anthropic.com/en/docs/tool-use) , [Anthropic: Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) , [0xeb/TheBigPromptLibrary (MIT)](https://github.com/0xeb/TheBigPromptLibrary)

## The Problem This Solves

Tool definitions are context. The model reads them to decide which tool to call, what arguments to pass, and what the result means. The quality of those definitions determines whether it gets any of that right.

Poor descriptions cause cascading failures. The model picks the wrong tool, or the right tool with wrong arguments, or misses an opportunity to use a tool entirely. Each failed call wastes a turn, burns tokens, and often requires the user to intervene. The problem compounds in agentic loops where the model makes dozens of tool calls in sequence; one bad description can derail an entire chain of reasoning.

## How It Works

A tool definition has four parts, and the last two get the least attention but carry the most weight:

1.  **Name:** should suggest purpose. `search_knowledge_base` is clear; `query_42` is not.
2.  **Description:** the most important part. Tells the model not just what the tool does, but when to use it and what it doesn’t do; this is the context that drives tool selection.
3.  **Parameters:** the input schema. Use [Schema Steering](schema-steering.md) here; typed parameters with descriptions constrain what the model passes.
4.  **Return description:** what comes back and how to interpret it. Often omitted, but it helps the model plan multi-step workflows where one tool’s output feeds another.

The description is where most of the value lives. Compare:

```
# The model has to guess when to use this and what it covers
def search_documents(query: str):
    """Search for documents matching the query."""

# The model knows exactly when this is appropriate
def search_documents(query: str):
    """Search the internal knowledge base for policies,
    procedures, and FAQs. Use when the user asks about
    company processes or specific procedures. Returns
    top 5 results with excerpts. Does NOT search code
    repositories or customer data."""
```

The second version tells the model the scope (internal knowledge base), the trigger (company processes), the output shape (top 5 with excerpts), and the boundaries (not code, not customer data). The model can make an informed decision about whether this tool is appropriate for the current query.

## Example

A data analysis agent with three tools.

**Bad definitions** where the model has to guess:

```
def query_db(sql): """Run a SQL query."""
def create_chart(data, type): """Create a chart."""
def send_email(to, subject, body): """Send an email."""
```

**Good definitions** that provide the context the model needs:

```
def query_db(sql):
    """Execute a read-only SQL query against the analytics
    database. Use for metrics, counts, aggregations, and
    lookups by ID. Do NOT use for writes or schema info
    (use describe_tables instead).
    Returns: JSON array of matching rows."""

def create_chart(data, chart_type):
    """Create a visualization from query results.
    Use after query_db when the user wants to see data
    visually. chart_type: 'bar' | 'line' | 'pie' | 'scatter'.
    Returns: URL to the generated chart image."""

def send_email(to, subject, body):
    """Send results to a user. Use ONLY after analysis is
    complete with results to share. Do not send test
    messages or debugging output.
    Requires: valid email, non-empty subject and body."""
```

The model now knows the ordering (query first, then chart, then email), the constraints (read-only queries, no test emails), and the relationships between tools (chart takes query output). These descriptions function as a lightweight workflow specification embedded in the tool context.

## In the Wild: How Production Systems Do This

Claude’s system prompt on claude.ai includes a tool called `repl` (an in-browser JavaScript execution environment). The tool description is hundreds of tokens long and follows the pattern above almost exactly. The critical section is the usage boundary:

> Use the analysis tool ONLY for: Complex math problems that require a high level of accuracy and cannot easily be done with mental math… Do NOT use analysis for problems like “4,847 times 3,291?”, “what’s 15% of 847,293?”… Use analysis only for MUCH harder calculations like “square root of 274635915822?”, “847293 \* 652847”

This is a tool description doing real work. It specifies the trigger (complex math), the anti-trigger (anything the model can do in its head), and provides concrete examples of both sides of the line. Without these boundaries the model would route every arithmetic question through the tool, adding latency and consuming tokens on tasks it can handle natively.

GitHub Copilot CLI takes a different approach: its `bash` tool description includes mode-specific guidance (sync vs. async vs. detached), worked examples for each mode, and explicit instructions about when to use interactive features. The description functions as a mini operating manual, which makes sense for a tool complex enough that mode selection matters for correctness.

The cost of these detailed descriptions is real; Claude’s tool definitions alone consume over 16,000 tokens per session, re-sent on every turn. But the cost of _not_ having them, wrong tool selection and wasted turns, compounds faster in agentic loops where the model makes dozens of calls in sequence.

## When to Use

- Any agent or tool-using system
- When you notice the model selecting wrong tools or passing bad parameters
- When adding a new tool to an existing set and the model needs to understand when to prefer it over alternatives

## When Not to Use

- Standard library functions the model already understands well
- Tools with names so descriptive they don’t need elaboration (rare, but it happens)

## Related Patterns

- **[Select, Don’t Dump](core/select.md)** applies to tool sets too; if the model sees 30 tools when only 5 are relevant to the current task, selection suffers regardless of description quality
- **[The Pyramid](core/pyramid.md)** structures tool definitions with the most important information first: what it does and when to use it before the parameter details
- **[Schema Steering](schema-steering.md)** uses typed parameter schemas to constrain what the model passes to each tool
