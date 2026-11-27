import { channelHref, channels, currentChannel } from '@/lib/docs-channel';

// One line above each page title that says which channel the reader is on.
// Beta: always, because what it describes may change before the next stable release.
// Stable: only while a newer beta is published, as a pointer to what is coming.
export function ChannelBanner({ pageUrl }: { pageUrl: string }) {
  const { stable, beta } = channels;

  if (currentChannel === 'beta') {
    return (
      <aside className="mb-4 rounded-lg border border-fd-primary/40 bg-fd-primary/5 px-4 py-3 text-sm">
        <span className="mr-2 rounded bg-fd-primary px-1.5 py-0.5 font-mono text-xs font-semibold uppercase text-fd-primary-foreground">
          Beta
        </span>
        You are reading the docs for the beta channel
        {beta.version ? (
          <>
            {' '}
            (<code>{beta.version}</code>)
          </>
        ) : null}
        . Features may change before the next stable release.{' '}
        <a className="font-medium text-fd-primary underline" href={channelHref('stable', pageUrl)}>
          Switch to stable{stable.version ? ` (${stable.version})` : ''} →
        </a>
      </aside>
    );
  }

  if (!beta.version) return null;
  return (
    <aside className="mb-4 rounded-lg border border-fd-border bg-fd-secondary/50 px-4 py-3 text-sm text-fd-muted-foreground">
      Beta <code>{beta.version}</code> is out: install it with <code>mewkit init --beta</code>.{' '}
      <a className="font-medium text-fd-primary underline" href={channelHref('beta', pageUrl)}>
        Read the beta docs →
      </a>
    </aside>
  );
}
