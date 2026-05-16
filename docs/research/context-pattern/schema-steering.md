# Schema Steering

> Source: https://contextpatterns.com/patterns/schema-steering/

A JSON schema tells the model what to think about, in what order, and with what vocabulary. Define the structure and the model's reasoning follows.

[Anthropic: Tool Use Documentation](https://docs.anthropic.com/en/docs/tool-use) , [OpenAI: Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)

## The Problem This Solves

When you ask a model to produce unstructured text, you get unstructured reasoning: it wanders, includes fields you don’t need, omits ones you do, and formats things differently every time. You end up writing fragile parsing code to extract what you actually wanted.

Without a clear target shape, the model doesn’t know what matters. Give it a schema and you’re telling it what dimensions to reason along.

## How It Works

Provide the model with a structured schema that defines the expected output. The schema becomes part of the context and influences reasoning as well as formatting.

A severity enum of `["critical", "high", "medium", "low"]` forces the model to evaluate severity on a specific scale, and a required `root_cause` field means it has to identify a cause. The schema shapes the thinking.

**Three levels of steering:**

1.  **Format hints:** “Respond in JSON” or “use bullet points.” Weak steering. The model may still produce inconsistent formats.
2.  **Partial schemas:** Define the fields you care about, leave the rest open. Useful when you need structure in some areas but flexibility in others.
3.  **Full schemas with constraints:** Complete type definitions, required fields, enums, and field descriptions. Strong steering that guides the entire output.

The field descriptions matter most. Compare `"severity": string` with `"severity": {"type": "string", "enum": ["critical", "high", "medium", "low"], "description": "Impact on system functionality"}`. The second version constrains vocabulary and tells the model what “severity” means in this context.

## Example

A bug triage system classifying incoming issues.

**Without schema steering:** the model produces a paragraph. “This seems pretty serious, probably related to memory since it happens under load.” You parse this manually, handle wording variations, and still miss edge cases.

**With schema steering:**

```
{
  "type": "object",
  "properties": {
    "severity": {
      "type": "string",
      "enum": ["critical", "high", "medium", "low"],
      "description": "Impact on system functionality"
    },
    "root_cause": {
      "type": "string",
      "description": "The underlying technical cause"
    },
    "affected_component": {
      "type": "string",
      "description": "Which system component is affected"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "How confident the classification is"
    }
  },
  "required": ["severity", "root_cause", "affected_component", "confidence"]
}
```

The model now thinks in terms of the schema. It produces structured data that slots directly into your triage workflow. No parsing, no variation handling, no guessing what “pretty serious” maps to.

Anthropic’s tool use works the same way: you define tools with input schemas, and the model reasons about which tool to call and what arguments to pass. The schema is the context that drives the decision.

## When to Use

- Data extraction from unstructured sources
- Classification tasks with defined categories
- Any integration where downstream code expects structured data
- When consistent output format across many queries matters

## When Not to Use

- Creative writing or open-ended exploration where structure would constrain useful thinking
- When you don’t yet know what the output should look like (explore first, then add schema)
- When the schema itself is so complex it becomes the bottleneck

## Related Patterns

- **[Select, Don’t Dump](core/select.md)** determines what context surrounds the schema; the schema steers output, but the supporting context still needs curation
- **[The Pyramid](core/pyramid.md)** structures the additional context provided alongside the schema
- **[Grounding](core/grounding.md)** combines naturally with schema steering to extract structured facts from retrieved documents
