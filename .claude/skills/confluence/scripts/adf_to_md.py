"""ADF (Atlas Doc Format) -> macro-aware Markdown walker.

Reads an ADF JSON document from stdin, emits Markdown that preserves
Confluence macros (panel, decisionList/Item, taskList/Item, expand,
mention, media, inlineCard, blockCard) with explicit labels so a
downstream LLM can reason over them as first-class signals.

Unknown nodes fall back to a keys-only metadata block (never raw
text/attr values) so attacker-controlled instruction strings inside a
custom macro cannot be surfaced verbatim.

stdlib-only.
"""
import json
import re
import sys
from typing import Any

INJECTION_RE = re.compile(
    r"ignore\s+previous\s+instructions|disregard\s+(?:your|the)\s+rules"
    r"|you\s+are\s+now|new\s+system\s+prompt|forget\s+your\s+rules"
    r"|pretend\s+you\s+are|act\s+as\s+if",
    re.IGNORECASE,
)

PANEL_LABELS = {"info": "INFO", "warning": "WARN", "note": "NOTE", "success": "OK", "error": "ERROR"}

_SCRUB = (("\\", ""), ("`", ""), ("[", "("), ("]", ")"),
          ("|", "/"), ("\n", " "), ("\r", " "))


def _scrub_mention(display: str) -> str:
    if INJECTION_RE.search(display or ""):
        return "[REDACTED_DISPLAY_NAME]"
    safe = display or "user"
    for ch, repl in _SCRUB:
        safe = safe.replace(ch, repl)
    return safe


def _apply_marks(text: str, marks: list) -> str:
    for m in marks or []:
        if m.get("type") == "code":
            text = "`" + text + "`"
    for m in marks or []:
        t = m.get("type")
        if t == "link":
            href = (m.get("attrs") or {}).get("href", "")
            text = "[" + text + "](" + href + ")"
        elif t == "strong":
            text = "**" + text + "**"
        elif t == "em":
            text = "_" + text + "_"
        elif t == "strike":
            text = "~~" + text + "~~"
        elif t == "underline":
            text = "<u>" + text + "</u>"
        elif t == "subsup":
            tag = "sup" if (m.get("attrs") or {}).get("type") == "sup" else "sub"
            text = f"<{tag}>{text}</{tag}>"
    return text


def _walk_children(node, ctx):
    return "".join(_walk(c, ctx) for c in (node.get("content") or []))


_walk_inline = _walk_children  # ADF uses identical recursion for both


def _quote_block(label: str, body: str) -> str:
    body = body.strip()
    indented = "\n".join("> " + ln if ln else ">" for ln in body.splitlines())
    return f"> [{label}]\n{indented}\n\n"


def _h_doc(n, c): return _walk_children(n, c)
def _h_para(n, c): return _walk_inline(n, c) + "\n\n"


def _h_heading(n, c):
    lvl = max(1, min(6, int((n.get("attrs") or {}).get("level", 1))))
    return ("#" * lvl) + " " + _walk_inline(n, c) + "\n\n"


def _h_bullet(n, c):
    items = ("- " + _walk(ch, c).rstrip() + "\n" for ch in (n.get("content") or []))
    return "".join(items) + "\n"


def _h_ordered(n, c):
    items = (f"{i}. " + _walk(ch, c).rstrip() + "\n"
             for i, ch in enumerate(n.get("content") or [], start=1))
    return "".join(items) + "\n"


def _h_list_item(n, c): return _walk_children(n, c).strip()


def _h_code(n, c):
    lang = (n.get("attrs") or {}).get("language", "") or ""
    return f"```{lang}\n{_walk_inline(n, c)}\n```\n\n"


def _h_quote(n, c):
    body = _walk_children(n, c).strip()
    return "\n".join("> " + ln if ln else ">" for ln in body.splitlines()) + "\n\n"


def _h_rule(n, c): return "---\n\n"
def _h_hb(n, c): return "  \n"


def _h_table(n, c):
    rows = []
    for row in n.get("content") or []:
        if row.get("type") == "tableRow":
            cells = [_walk(cc, c).strip().replace("\n", " ")
                     for cc in (row.get("content") or [])]
            rows.append("| " + " | ".join(cells) + " |")
    if not rows:
        return ""
    cols = max(1, rows[0].count("|") - 1)
    sep = "| " + " | ".join(["---"] * cols) + " |"
    return rows[0] + "\n" + sep + "\n" + "\n".join(rows[1:]) + "\n\n"


def _h_cell(n, c): return _walk_children(n, c)


def _h_panel(n, c):
    pt = ((n.get("attrs") or {}).get("panelType") or "info").lower()
    return _quote_block(PANEL_LABELS.get(pt, pt.upper()), _walk_children(n, c))


def _h_dlist(n, c): return _walk_children(n, c)
def _h_ditem(n, c): return _quote_block("DECISION", _walk_children(n, c))
def _h_tlist(n, c): return _walk_children(n, c) + "\n"


def _h_titem(n, c):
    state = (n.get("attrs") or {}).get("state", "TODO")
    box = "[x]" if state == "DONE" else "[ ]"
    return f"- {box} " + _walk_inline(n, c).rstrip() + "\n"


def _h_expand(n, c):
    title = (n.get("attrs") or {}).get("title", "Click to expand")
    body = _walk_children(n, c).strip()
    return f"<details>\n<summary>{title}</summary>\n\n{body}\n\n</details>\n\n"


def _h_msingle(n, c): return _walk_children(n, c) + "\n\n"


def _h_media(n, c):
    a = n.get("attrs") or {}
    aid = a.get("id", "unknown")
    alt = a.get("alt") or a.get("__fileName") or aid
    return f"![{alt}](attachment:{aid})"


def _h_icard(n, c):
    a = n.get("attrs") or {}
    url = a.get("url", "")
    title = (a.get("data") or {}).get("title") or url or "smart-card"
    return f"[{title}]({url}) [smart-card]"


def _h_bcard(n, c): return _h_icard(n, c) + "\n\n"


def _h_text(n, c):
    return _apply_marks(n.get("text", ""), n.get("marks", []))


def _h_mention(n, c):
    a = n.get("attrs") or {}
    raw = a.get("text") or a.get("displayName") or "user"
    display = _scrub_mention(raw)
    uid = a.get("id", "unknown")
    if display != "[REDACTED_DISPLAY_NAME]":
        c.setdefault("mention_footnotes", {})[display] = uid
    return f"@{display}"


def _h_emoji(n, c):
    a = n.get("attrs") or {}
    return a.get("text") or a.get("shortName") or ""


HANDLERS = {
    "doc": _h_doc, "paragraph": _h_para, "heading": _h_heading,
    "bulletList": _h_bullet, "orderedList": _h_ordered,
    "listItem": _h_list_item, "codeBlock": _h_code,
    "blockquote": _h_quote, "rule": _h_rule, "hardBreak": _h_hb,
    "table": _h_table, "tableRow": _h_table,
    "tableHeader": _h_cell, "tableCell": _h_cell,
    "panel": _h_panel,
    "decisionList": _h_dlist, "decisionItem": _h_ditem,
    "taskList": _h_tlist, "taskItem": _h_titem,
    "expand": _h_expand, "nestedExpand": _h_expand,
    "media": _h_media, "mediaInline": _h_media,
    "mediaSingle": _h_msingle, "mediaGroup": _h_msingle,
    "inlineCard": _h_icard, "blockCard": _h_bcard,
    "text": _h_text, "mention": _h_mention, "emoji": _h_emoji,
}


def _walk(node: Any, ctx: dict) -> str:
    if not isinstance(node, dict):
        return ""
    ntype = node.get("type")
    handler = HANDLERS.get(ntype)
    if handler:
        return handler(node, ctx)
    attrs = node.get("attrs")
    meta = {
        "type": ntype,
        "keys": sorted(node.keys()),
        "attr_keys": sorted(attrs.keys()) if isinstance(attrs, dict) else [],
    }
    return (f"\n[UNHANDLED_NODE: {ntype}]\n```json\n"
            f"{json.dumps(meta, indent=2, sort_keys=True)}\n```\n\n")


def main():
    try:
        adf = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"[adf-to-md] invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(adf, dict) or adf.get("type") != "doc":
        print("[adf-to-md] structural error: root must be {type: 'doc'}",
              file=sys.stderr)
        sys.exit(2)
    ctx: dict = {"mention_footnotes": {}}
    md = _walk(adf, ctx)
    fns = ctx.get("mention_footnotes") or {}
    if fns:
        md = md.rstrip() + "\n\n---\n\n## User References\n\n"
        for display, uid in sorted(fns.items()):
            md += f"- @{display} -> user-id: `{uid}`\n"
    sys.stdout.write(md.rstrip() + "\n")


if __name__ == "__main__":
    main()
