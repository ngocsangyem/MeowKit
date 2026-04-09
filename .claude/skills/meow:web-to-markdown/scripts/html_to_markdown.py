#!/usr/bin/env python3
"""
html_to_markdown.py — HTML extraction and conversion helpers for meow:web-to-markdown.

Extracted from fetch_as_markdown.py to keep files under 400 lines.
All logic is pure / side-effect-free; no network calls.

Exports:
    best_markdown_from_html(html: str) -> str
    is_thin_content(markdown: str, threshold: int) -> bool
    maybe_fix_mojibake(text: str) -> str
"""

import re

try:
    from readability import Document
    _READABILITY_AVAILABLE = True
except ImportError:
    _READABILITY_AVAILABLE = False

try:
    import lxml.html
    _LXML_AVAILABLE = True
except ImportError:
    _LXML_AVAILABLE = False

import html2text


# ---------------------------------------------------------------------------
# Core converters
# ---------------------------------------------------------------------------

def _html_to_markdown(html: str) -> str:
    """Convert HTML to markdown. Images are stripped — noise for agents."""
    converter = html2text.HTML2Text()
    converter.ignore_links = False
    converter.ignore_images = True
    converter.ignore_emphasis = False
    converter.body_width = 0
    converter.skip_internal_links = True
    converter.single_line_break = True
    return converter.handle(html).strip()


def _extract_main_content(html: str) -> str:
    """Extract primary content with readability when available."""
    if _READABILITY_AVAILABLE:
        try:
            return Document(html).summary(html_partial=True)
        except Exception:
            pass
    return html


def maybe_fix_mojibake(text: str) -> str:
    """Fix common UTF-8/latin-1 mojibake artifacts (â€™, Â, etc.)."""
    if "â" not in text and "Â" not in text:
        return text
    try:
        fixed = text.encode("latin1", errors="ignore").decode("utf-8", errors="ignore")
    except Exception:
        return text
    if fixed.count("â") + fixed.count("Â") < text.count("â") + text.count("Â"):
        return fixed
    return text


# ---------------------------------------------------------------------------
# lxml-based content stripping
# ---------------------------------------------------------------------------

def _strip_noncontent_nodes(doc: "lxml.html.HtmlElement") -> None:
    """Remove common non-content containers from an lxml doc in-place."""
    for tag in ["nav", "aside", "footer", "header", "script", "style", "noscript"]:
        for node in doc.xpath(f"//{tag}"):
            parent = node.getparent()
            if parent is not None:
                parent.remove(node)
    for node in doc.xpath("//*[@role='navigation' or @role='banner' or @role='contentinfo']"):
        parent = node.getparent()
        if parent is not None:
            parent.remove(node)
    consent_xpath = (
        "//*[contains(translate(@id,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'cookie') "
        "or contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'cookie') "
        "or contains(translate(@id,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'consent') "
        "or contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'consent')]"
    )
    for node in doc.xpath(consent_xpath):
        parent = node.getparent()
        if parent is not None:
            parent.remove(node)


def _candidate_html_blocks(html: str) -> list[str]:
    """Return candidate HTML blocks for conversion (readability, main, article, body, raw)."""
    candidates: list[str] = [_extract_main_content(html)]
    if _LXML_AVAILABLE:
        try:
            # huge_tree=False prevents XML bomb amplification (Layer 3)
            parser = lxml.html.HTMLParser(huge_tree=False)
            doc = lxml.html.fromstring(html, parser=parser)
            for xpath_tag in ["//main", "//article"]:
                for node in doc.xpath(xpath_tag)[:2]:
                    node_doc = lxml.html.fromstring(
                        lxml.html.tostring(node, encoding="unicode", method="html"),
                        parser=lxml.html.HTMLParser(huge_tree=False),
                    )
                    _strip_noncontent_nodes(node_doc)
                    candidates.append(
                        lxml.html.tostring(node_doc, encoding="unicode", method="html")
                    )
            for node in doc.xpath("//body")[:1]:
                node_doc = lxml.html.fromstring(
                    lxml.html.tostring(node, encoding="unicode", method="html"),
                    parser=lxml.html.HTMLParser(huge_tree=False),
                )
                _strip_noncontent_nodes(node_doc)
                candidates.append(
                    lxml.html.tostring(node_doc, encoding="unicode", method="html")
                )
        except Exception:
            pass
    candidates.append(html)
    seen: set[str] = set()
    unique: list[str] = []
    for item in candidates:
        key = item.strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


# ---------------------------------------------------------------------------
# Markdown cleanup
# ---------------------------------------------------------------------------

def _clean_markdown(markdown: str) -> str:
    """Post-process to remove common noise patterns from converted markdown."""
    markdown = re.sub(r"\n{3,}", "\n\n", markdown)
    markdown = re.sub(r"^\W{3,}$", "", markdown, flags=re.MULTILINE)
    cookie_patterns = [
        r"select your cookie preferences", r"cookie preferences",
        r"we use (essential )?cookies", r"accept\s+decline\s+customize",
        r"manage cookies", r"privacy choices",
    ]
    for pat in cookie_patterns:
        markdown = re.sub(pat, "", markdown, flags=re.IGNORECASE)
    return markdown.strip()


# ---------------------------------------------------------------------------
# Scoring and selection
# ---------------------------------------------------------------------------

def best_markdown_from_html(html: str) -> str:
    """Convert HTML to best-candidate markdown using readability + scored extraction."""
    best = ""
    best_score = float("-inf")
    for idx, candidate in enumerate(_candidate_html_blocks(html)):
        md = _clean_markdown(_html_to_markdown(candidate))
        visible = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", md)
        visible = re.sub(r"https?://\S+", "", visible)
        visible = re.sub(r"\s+", " ", visible).strip()
        visible_len = len(visible)
        link_count = md.count("](")
        pipe_count = md.count("|")
        heading_count = md.count("\n#") + (1 if md.startswith("#") else 0)
        lower = visible.lower()
        cookie_hits = sum(1 for s in [
            "cookie preferences", "select your cookie preferences",
            "we use essential cookies", "accept", "decline", "customize",
        ] if s in lower)
        toc_hits = 1 if ("table of contents" in lower or "contents" in lower[:200]) else 0
        score = float(visible_len)
        score += heading_count * 50.0
        score -= link_count * 10.0
        score -= pipe_count * 2.0
        score -= cookie_hits * 500.0
        score -= toc_hits * 250.0
        score -= idx * 5.0
        if visible_len < 400:
            score -= 200.0
        if score > best_score:
            best = md
            best_score = score
    return best


def is_thin_content(markdown: str, threshold: int = 200) -> bool:
    """Return True if markdown has fewer than threshold chars of real text."""
    return len(re.sub(r"\s+", " ", markdown).strip()) < threshold
