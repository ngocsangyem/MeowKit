# Image Analysis Workflow

**Use when:** Task involves screenshots, mockups, diagrams, photos, OCR

**Speed:** Fast (5-15s)
**Model:** gemini-2.5-flash (default)

## Steps

```bash
# 1. Verify setup
python .claude/skills/meow:multimodal/scripts/check_setup.py

# 2. Analyze image
python .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files <image-path> \
  --task analyze \
  [--prompt "Focus on UI layout and color scheme"] \
  [--json]

# 3. For OCR / text extraction
python .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files <image-path> \
  --task extract

# 4. For multi-image comparison
python .claude/skills/meow:multimodal/scripts/gemini_analyze.py \
  --files before.png after.png \
  --task analyze \
  --prompt "Compare these two screenshots"
```

## Common Use Cases

- **Code review:** Analyze screenshot of UI to verify implementation matches design
- **Bug reports:** Analyze error screenshots to identify the issue
- **Design extraction:** Extract colors, fonts, layout from mockup images
- **OCR:** Read text from receipts, documents, handwritten notes
