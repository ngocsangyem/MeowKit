import { defineDocs, defineConfig, frontmatterSchema } from 'fumadocs-mdx/config';
import { remarkMdxMermaid, remarkMdxFiles } from 'fumadocs-core/mdx-plugins';
import { z } from 'zod';

// The frontmatter contract: which runtime file owns a page's facts, and when a human last
// checked them. Both optional — the rollout is optional, then backfill, then required for the
// pages that carry runtime facts, so no single commit has to touch every page.
//
// `zod` is declared in this package on purpose. fumadocs-mdx builds `frontmatterSchema` with
// zod 4, while the workspace hoists zod 3; extending a v4 schema with a v3 field parses as
// "expected a Zod schema" at build time. Both must be the same major.
//
// `status: canonical|redirect|deprecated` is deliberately NOT here. Retirement is recorded once
// in `redirects.json`, which drives the 308, the llms.txt and sitemap exclusion, and the
// link-target rejection together. A second per-page declaration would let a page claim retired
// while still being served, or the reverse.
const meowkitFrontmatter = frontmatterSchema.extend({
  /** The `.claude/` or `packages/` file whose contents this page restates. */
  sourceOfTruth: z.string().optional(),
  /** ISO date a human last checked this page against its source. */
  lastVerified: z.string().optional(),
});

export const docs = defineDocs({
  dir: 'content/docs',
  // Expose processed Markdown (page.data.getText('processed')) for llms.txt,
  // llms-full.txt, and per-page .md routes.
  docs: {
    schema: meowkitFrontmatter,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    // `remarkMdxFiles` claims ```files fences and rewrites them to <Files>/<Folder>/<File>.
    // Directory trees drawn by hand in box-drawing characters cannot survive a webfont whose
    // subset omits U+2500-257F — the glyphs fall back to a font with a different advance
    // width and the columns shear apart. A real tree component has no column to shear.
    remarkPlugins: [remarkMdxMermaid, remarkMdxFiles],
  },
});
