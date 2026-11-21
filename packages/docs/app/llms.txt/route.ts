import { getPublishedPages } from '@/lib/get-published-pages';

export const revalidate = false;

// llms.txt index — one line per page, grouped nowhere (flat), for AI agents.
export function GET() {
  const lines = getPublishedPages().map((page) => {
    const title = page.data.title ?? page.url;
    const desc = page.data.description ? `: ${page.data.description}` : '';
    return `- [${title}](${page.url})${desc}`;
  });
  const body = `# MeowKit Documentation

> AI agent toolkit for Claude Code, Codex, Cursor, Grok, Pi and OMP: skills, agents, a planned and reviewed workflow, a ship check that refuses failing commits, and a credential read guard.

## Pages

${lines.join('\n')}
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
