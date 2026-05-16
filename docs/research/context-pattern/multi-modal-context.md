# Multi-Modal Context

> Source: https://contextpatterns.com/patterns/multi-modal-context/

Images consume tokens aggressively and at unpredictable rates. Choose the right modality for each piece of context (raw image, text description, or structured extraction) before the model sees it.

[Anthropic: Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) , [OpenAI: Vision — Image Inputs](https://platform.openai.com/docs/guides/vision) , [Microsoft: Multimodal RAG with Vision](https://devblogs.microsoft.com/ise/multimodal-rag-with-vision/)

## The Problem This Solves

Sending an image to a vision model feels like sending a file, but it’s actually sending hundreds to thousands of tokens depending on image size and provider. A single 1024x1024 screenshot consumes roughly 1,600 tokens with Claude and 765 tokens with GPT-4o at high detail. Send five images and you’ve spent 3,000 to 8,000 tokens before any text context has been included.

Teams building multi-modal pipelines often discover this late. An agentic loop that processes UI screenshots burns through context budgets in a few iterations, costs spike, and latency doubles. None of this happens because vision is inherently expensive; it happens because the wrong modality was chosen for the task.

## How It Works

Every piece of visual information has three possible representations, each with a different token cost and fidelity ceiling:

1.  **Raw image:** The actual image bytes sent to the model. Full fidelity, highest token cost. Required when the visual details themselves are the signal: spatial layout, color, handwriting, diagrams, UI element positions.
2.  **Text description:** A prose or structured description generated in advance by a cheaper call, a caption model, or a human. Low token cost but loses visual fidelity. Appropriate when the semantic content matters but the visual form does not: a photo of a document where only the text matters, or a chart where only the trend matters.
3.  **Structured extraction:** Data pulled from the image and encoded as JSON, a Markdown table, or key-value pairs. Near-zero token cost once extracted. Appropriate when you need specific fields rather than the image as a whole: invoice line items, form field values, chart data points.

**The decision rule:** ask what the model actually needs to do with the visual content.

- If the task requires reading or reasoning about the visual form (spatial layout, handwriting, diagram structure, pixel-level details), use the raw image.
- If the task only needs the semantic content (what it says, what the trend is, what category it belongs to), extract or describe first and pass text.
- If the same image will be used in multiple requests or steps, extract once and reuse the text representation; the amortized cost makes this almost always worthwhile.

**Token cost reference** (approximate; verify against current [Anthropic](https://platform.claude.com/docs/en/build-with-claude/vision) and [OpenAI](https://platform.openai.com/docs/guides/vision) docs as these change):

Image size

Claude (tokens)

GPT-4o high detail (tokens)

GPT-4o low detail (tokens)

512x512

~380

~255

85

1024x768

~1,020

~765

85

1920x1080

~2,100

~1,105

85

GPT-4o’s `detail: low` mode processes any image at a fixed 85 tokens by downsampling aggressively. It loses fine detail but works for tasks that only need coarse content: “what type of document is this?” or “does this image contain a person?”

**Resolution discipline:** most vision models recommend keeping images at or below 1.15 megapixels for optimal latency and token efficiency. Sending a 4K screenshot for a task that needs to read a modal dialog is pure waste. Resize before sending.

## Example

An agent that processes scanned invoices to extract line items and totals.

**Without modality selection:** the agent sends each scanned invoice (typically 2,500x3,300 pixels) directly. Each invoice consumes ~3,500 tokens, so processing 50 invoices in a batch costs 175,000 tokens in image context alone before any reasoning tokens are counted.

**With modality selection:** a lightweight extraction step runs first (a smaller vision call at low detail, or a document OCR pipeline), converting each invoice to a structured JSON object:

```
{
  "vendor": "Acme Supplies",
  "invoice_date": "2026-02-15",
  "line_items": [
    {"description": "Widget A", "qty": 10, "unit_price": 24.99, "total": 249.90},
    {"description": "Widget B", "qty": 5, "unit_price": 12.50, "total": 62.50}
  ],
  "subtotal": 312.40,
  "tax": 25.00,
  "total": 337.40
}
```

The reasoning agent now receives this JSON (~120 tokens) instead of the raw image, dropping batch cost from 175,000 image tokens to 6,000 text tokens. The trade-off is that if a line item is ambiguous or the OCR makes an error, the agent cannot inspect the original image; for that case, pass the raw image as a fallback. For clean, structured invoices, the extraction path is strictly better.

**For multi-modal RAG:** store both the raw image and a text description or extracted data at index time. Retrieve the text representation for most queries and reserve raw image retrieval for queries that explicitly require visual reasoning.

## When to Use

- Any pipeline that processes multiple images per request or per agent loop
- Document processing, form extraction, and screenshot analysis tasks
- When image inputs are homogeneous and structured (invoices, receipts, forms, charts with known schemas)
- When context budget pressure is visible and images are a significant contributor to token costs

## When Not to Use

- Tasks where the visual form is the point: handwriting recognition, UI rendering verification, spatial layout analysis, diagram interpretation
- Single-image, single-question queries where the overhead of extraction doesn’t pay off
- When the downstream task requires the model to discover what’s in the image rather than process known content

## Related Patterns

- **[Context Budget](context-budget.md)** sets the frame: images are the highest-token-per-unit input type and should be allocated a specific budget slot upfront
- **[Select, Don’t Dump](core/select.md)** applies to modality choice: use the minimum fidelity that supports the task
- **[Compress & Restart](core/compress.md)** is the recovery path when a multi-modal agent has accumulated too many image tokens; extract and compress visual state to text before continuing
