# Product Area Configuration Reference

Optional team-specific routing enhancement via `.claude/product-areas.yaml`.
When the file does not exist, scale-routing operates in CSV-only mode — no degradation.

## Contents

- [When to Use](#when-to-use)
- [Creating `.claude/product-areas.yaml`](#creating-claudeproduct-areasyaml)
- [Schema](#schema)
- [How scale-routing Loads It](#how-scale-routing-loads-it)
- [Output When YAML Present](#output-when-yaml-present)
- [Output Without YAML (CSV-only mode)](#output-without-yaml-csv-only-mode)


---

## When to Use

Use product area config when your team needs:
- Routing by specific codebase paths (not just keyword matching)
- Person-in-charge (PIC) suggestions per area
- Custom keyword sets for internal domain language

Without this file, scale-routing works identically to v1.0. It is purely additive.

---

## Creating `.claude/product-areas.yaml`

Place the file at the root of your project's `.claude/` directory:

```
your-project/
└── .claude/
    └── product-areas.yaml
```

---

## Schema

```yaml
areas:
  - name: Authentication
    paths:
      - "src/auth/**"
      - "src/middleware/auth*"
    keywords:
      - "login"
      - "session"
      - "token"
      - "OAuth"
    pic:                    # optional — team members for this area
      - "alice"
      - "bob"

  - name: Payments
    paths:
      - "src/billing/**"
      - "src/payments/**"
    keywords:
      - "invoice"
      - "subscription"
      - "stripe"
    pic:
      - "charlie"
```

**Field reference:**

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | Yes | string | Display name for the product area |
| `paths` | Yes | string[] | Glob patterns matching source files for this area |
| `keywords` | Yes | string[] | Additional keywords beyond CSV signals |
| `pic` | No | string[] | Team members responsible for this area |

---

## How scale-routing Loads It

1. Check if `.claude/product-areas.yaml` exists in the project root
2. If found → parse areas, merge keywords with CSV domain signals
3. If a task matches a product area's paths or keywords → set `product_area` in output
4. If `pic` defined → include PIC suggestion in output
5. If not found → CSV-only mode, `product_area` field omitted from output

**Path matching** uses the mentioned files in the task description (Layer 1) against area `paths` globs.
**Keyword matching** supplements Layer 0 CSV matching with area-specific terms.

---

## Output When YAML Present

```json
{
  "domain": "fintech",
  "level": "high",
  "product_area": "Payments",
  "pic": ["charlie"],
  "confidence": "HIGH"
}
```

## Output Without YAML (CSV-only mode)

```json
{
  "domain": "fintech",
  "level": "high",
  "confidence": "HIGH"
}
```

No `product_area` or `pic` fields — no degradation of existing behavior.