'use client';

import { useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

// Renders ```mermaid fences (rewritten to <Mermaid chart="..."/> by
// remarkMdxMermaid). Lazy-loads the mermaid library on the client only and
// re-renders when the resolved color scheme changes.
export function Mermaid({ chart }: { chart: string }) {
  const id = useId();
  const [svg, setSvg] = useState('');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        fontFamily: 'inherit',
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
      });
      try {
        const { svg: rendered } = await mermaid.render(
          // useId() may contain ':' which is invalid in a DOM id for mermaid
          id.replaceAll(':', ''),
          chart.replaceAll('\\n', '\n'),
        );
        if (!cancelled) setSvg(rendered);
      } catch (error) {
        console.error('mermaid render failed', error);
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
