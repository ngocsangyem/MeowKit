import { getPublishedPages } from '@/lib/get-published-pages';
import { getLLMText } from '@/lib/get-llm-text';

export const revalidate = false;

// llms-full.txt — the entire corpus as one Markdown document.
export async function GET() {
  const scanned = await Promise.all(getPublishedPages().map(getLLMText));
  return new Response(scanned.join('\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
