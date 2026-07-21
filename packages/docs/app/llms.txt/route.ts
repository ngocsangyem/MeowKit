import { source } from '@/lib/source';

export const revalidate = false;

// llms.txt index — one line per page, grouped nowhere (flat), for AI agents.
export function GET() {
  const lines = source.getPages().map((page) => {
    const title = page.data.title ?? page.url;
    const desc = page.data.description ? `: ${page.data.description}` : '';
    return `- [${title}](${page.url})${desc}`;
  });
  const body = `# MeowKit Documentation

> AI agent toolkit for Claude Code — skills, agents, and a structured workflow with hard gates, TDD, security scanning, and scale-adaptive routing.

## Pages

${lines.join('\n')}
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
