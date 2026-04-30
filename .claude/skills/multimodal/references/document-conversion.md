# Document Conversion Reference

## Supported Formats

| Format | Quality | Notes |
|--------|---------|-------|
| PDF | Excellent | Native vision processing, handles scans |
| DOCX | Good | Structure preserved via OCR |
| XLSX | Good | Tables converted to Markdown |
| PPTX | Good | Slide content extracted |
| Images | Good | OCR extraction |
| HTML | Good | Structure preserved |

## CLI Examples

```bash
# Single file
.claude/skills/.venv/bin/python3 .claude/skills/multimodal/scripts/document_converter.py \
  --files report.pdf --output ./docs/

# Batch conversion
.claude/skills/.venv/bin/python3 .claude/skills/multimodal/scripts/document_converter.py \
  --files a.pdf b.docx c.xlsx --output ./output/ --verbose

# Custom prompt
.claude/skills/.venv/bin/python3 .claude/skills/multimodal/scripts/document_converter.py \
  --files invoice.pdf --prompt "Extract all line items as a Markdown table"
```

## Output

- Each file → `{output_dir}/{filename}_{ext}.md`
- Clean Markdown with heading hierarchy preserved
- Tables converted to Markdown tables
- Images replaced with `[Image: description]`
- Filename includes original extension to avoid collisions (e.g., `report_pdf.md`)

## Gotchas

- PDFs >100 pages: quality degrades. Split first.
- Scanned PDFs: works via OCR but slower
- Password-protected files: not supported
- File API used for >20MB files (auto)
- 0-byte files rejected with error
