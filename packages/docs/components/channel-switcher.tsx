'use client';

import { usePathname } from 'next/navigation';
import { channelHref, channels, currentChannel, type DocsChannel } from '@/lib/docs-channel';

// Two-segment control at the top of the sidebar: Stable | Beta, each with its version.
// The current channel is a plain label; the other one links to the same page on the other
// site, so switching keeps the reader where they were. A page that exists on one channel
// only lands on that channel's 404, which links back home.
export function ChannelSwitcher() {
  const pathname = usePathname() || '/';
  const order: DocsChannel[] = ['stable', 'beta'];

  return (
    <nav
      aria-label="Documentation channel"
      className="grid grid-cols-2 gap-1 rounded-lg border border-fd-border bg-fd-secondary/50 p-1 text-sm"
    >
      {order.map((id) => {
        const info = channels[id];
        const active = id === currentChannel;
        const body = (
          <>
            <span className="font-medium">{info.label}</span>
            <span className="font-mono text-xs text-fd-muted-foreground">
              {info.version || (id === 'beta' ? 'none ahead' : ' ')}
            </span>
          </>
        );
        const className = `flex flex-col items-center rounded-md px-2 py-1.5 leading-tight transition-colors ${
          active
            ? 'bg-fd-background text-fd-primary shadow-sm ring-1 ring-fd-border'
            : 'text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground'
        }`;
        return active ? (
          <span key={id} aria-current="page" className={className}>
            {body}
          </span>
        ) : (
          <a key={id} href={channelHref(id, pathname)} className={className}>
            {body}
          </a>
        );
      })}
    </nav>
  );
}
