# Vision Understanding Reference

## Core Capabilities

- **Captioning**: Generate descriptive text for images
- **Classification**: Categorize and identify content
- **Visual Q&A**: Answer questions about images
- **Object Detection**: Locate objects with bounding boxes (2.0+)
- **Segmentation**: Create pixel-level masks (2.5+)
- **Multi-image**: Compare up to 3,600 images
- **OCR**: Extract text from images and screenshots
- **Document Understanding**: Process PDFs with vision

## Supported Formats

- Images: PNG, JPEG, WEBP, HEIC, HEIF
- Documents: PDF (up to 1,000 pages)
- Size: 20MB inline, 2GB via File API

## Common Use Cases

### Screenshot Analysis
```bash
python scripts/gemini_analyze.py --files screenshot.png --task analyze \
  --prompt "Describe the UI layout, identify components, and note any issues"
```

### OCR / Text Extraction
```bash
python scripts/gemini_analyze.py --files receipt.jpg --task extract
```

### Multi-Image Comparison
```bash
python scripts/gemini_analyze.py --files before.png after.png --task analyze \
  --prompt "Compare these two screenshots and describe the differences"
```

### PDF Extraction
```bash
python scripts/gemini_analyze.py --files report.pdf --task extract
```

## Best Practices

1. **Be specific** in prompts — "Describe the button colors and layout" > "Describe this"
2. **Use structured output** — ask for JSON when you need programmatic data
3. **Compress large images** — 1920px width is plenty for analysis
4. **Split large PDFs** — process in chunks if > 100 pages for better accuracy
