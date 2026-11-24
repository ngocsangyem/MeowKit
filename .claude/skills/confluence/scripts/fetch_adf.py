"""Fetch one Confluence page with its body in ADF (atlas_doc_format) and print the JSON.

confluence-as 0.2.0 `page get` returns only storage, view or markdown bodies, so the
ADF read goes through the package's own client against the v2 pages endpoint. Run it
through `confluence-as.sh adf-get <page-id>`: the wrapper loads credentials and
applies the Cloud-only gate before this runs.
"""

import json
import sys

from confluence_assistant_skills import ConfluenceError, get_confluence_client


def main() -> int:
    page_id = sys.argv[1] if len(sys.argv) > 1 else ""
    if not page_id.isdigit():
        print("[adf-get] page id must be numeric", file=sys.stderr)
        return 1
    try:
        page = get_confluence_client().get(
            f"/api/v2/pages/{page_id}",
            params={"body-format": "atlas_doc_format"},
            operation="get page as ADF",
        )
    except ConfluenceError as error:
        print(f"[adf-get] {error}", file=sys.stderr)
        return 1
    print(json.dumps(page))
    return 0


if __name__ == "__main__":
    sys.exit(main())
