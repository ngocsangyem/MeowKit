# Document Extraction Workflow

**Use when:** Task involves PDFs, Office documents, scanned docs

**Speed:** Fast (5-30s per document)
**Model:** gemini-2.5-flash (default)

## Steps

```bash
# 1. Single PDF extraction
python .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files document.pdf \
  --task extract

# 2. With custom extraction prompt
python .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files report.pdf \
  --task extract \
  --prompt "Extract only the financial tables as markdown"

# 3. Multiple documents
python .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files doc1.pdf doc2.pdf doc3.pdf \
  --task extract \
  --json

# 4. Large PDF (> 20MB) — auto uses File API
python .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files large-report.pdf \
  --task extract \
  --verbose
```

## Supported Document Types

| Format | Extension | Notes |
|--------|-----------|-------|
| PDF | .pdf | Up to 1,000 pages, 2GB via File API |
| Word | .docx | Uploaded as binary |
| Excel | .xlsx | Tables extracted |
| PowerPoint | .pptx | Slides + notes extracted |
| HTML | .html | Rendered content extracted |
| Text | .txt, .csv | Direct text processing |
