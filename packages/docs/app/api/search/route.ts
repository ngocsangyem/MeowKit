import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

// Server-mode Orama search over the full corpus (SSR deploy target). The
// query is dynamic per request; the Orama index is built once in memory.
export const { GET } = createFromSource(source, {
  language: 'english',
});
