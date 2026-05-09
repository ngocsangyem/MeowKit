# Canary 3 — Long unstructured

**Mode:** default

## Input

A 1500-word user message mixing context, asks, and edge cases without
separators or structure. Representative shape:

```
Hey so we have this product page that's been getting slower and slower over
the last few months and the team is getting frustrated because every time we
add a new product variant the response gets bigger by like a few KB and now
it's at the point where the page takes 4 seconds to load on mobile which is
really bad for SEO and conversion. Anyway we tried adding caching but it
didn't help because the cache key was wrong, then we tried lazy loading the
images but that broke the SEO because Google was getting empty pages, then
we tried server-side rendering but our infra team said no because the box is
already at 80% CPU. So now we're thinking maybe we should add some kind of
prerendering or maybe streaming or I don't know really. Some edge cases to
think about: products with no images, products with 50+ images, products
that are out of stock, products that are on sale, products with custom
fields, products with regional pricing, products with variant SKUs, products
with bundles, products that ship internationally, products with backorder
status... [continues for 1500 words]
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | partial (improve perf, no metric) |
| Context | present (rich background) |
| Constraints | partial (no SSR, but mixed in narrative) |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found (≥3 of 10)

- #7 Laundry-list edge cases (10+ cases dumped as one wall)
- #8 Mixed instructions/data (no separators)
- #9 Wrong section ordering (long content not separated from instruction)

### Improvement Suggestions

- Split the wall into `CONTEXT` (history + prior attempts) and `EDGE CASES`
  (canonical 3, plus "and similar — extrapolate").
- Insert `--- DATA START / END ---` fences around the narrative dump.
- Move the actual ask to the end (long content first).

### Rewritten Prompt

Universal kernel with the long content in `CONTEXT`, edge cases reduced to 3
canonical examples, instruction at the bottom.
