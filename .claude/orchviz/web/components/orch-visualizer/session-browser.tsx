'use client';

/**
 * OrchViz — Session Browser Panel
 *
 * Slide-in panel listing recorded sessions.
 * Fetch /api/sessions on open, load events via /api/sessions/:id/events.
 */

import { useEffect, useState } from 'react';
import type { OrchEvent } from '@/hooks/simulation/types';
import { GlassCard } from './shared-ui';

interface SessionMeta {
  id: string;
  label: string;
  lastActivity: number;
  eventCount: number;
  isActive: boolean;
}

interface SessionBrowserProps {
  visible: boolean;
  onClose: () => void;
  onLoadSession: (events: OrchEvent[]) => void;
}

const PANEL_W = 320;

export function SessionBrowser({ visible, onClose, onLoadSession }: SessionBrowserProps) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch session list whenever panel opens
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    fetch('/api/sessions')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SessionMeta[]>;
      })
      .then(data => setSessions(data))
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [visible]);

  async function handleLoad(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      const r = await fetch(`/api/sessions/${encodeURIComponent(id)}/events`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { events: OrchEvent[] };
      onLoadSession(data.events);
      onClose();
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setLoadingId(null);
    }
  }

  function handleExport(id: string) {
    window.open(`/api/sessions/${encodeURIComponent(id)}/download`, '_blank');
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 49 }}
      />
      {/* Panel */}
      <GlassCard style={{
        position: 'fixed', top: 44, right: 0, bottom: 28,
        width: PANEL_W, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        borderRadius: 0, borderRight: 'none', borderTop: 'none', borderBottom: 'none',
        animation: 'glass-in 0.15s ease-out',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            letterSpacing: '0.08em' }}>
            SESSIONS
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--dim)',
              cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            aria-label="Close session browser"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading && (
            <div style={{ padding: '20px 14px', color: 'var(--dim)', fontSize: 11,
              textAlign: 'center' }}>
              Loading sessions…
            </div>
          )}
          {error && (
            <div style={{ padding: '10px 14px', color: 'var(--red)', fontSize: 10 }}>
              {error}
            </div>
          )}
          {!loading && sessions.length === 0 && !error && (
            <div style={{ padding: '20px 14px', color: 'var(--dim)', fontSize: 11,
              textAlign: 'center' }}>
              No recorded sessions found.
            </div>
          )}
          {sessions.map(s => (
            <SessionRow
              key={s.id}
              session={s}
              loadingId={loadingId}
              onLoad={handleLoad}
              onExport={handleExport}
            />
          ))}
        </div>
      </GlassCard>
    </>
  );
}

function SessionRow({
  session, loadingId, onLoad, onExport,
}: {
  session: SessionMeta;
  loadingId: string | null;
  onLoad: (id: string) => void;
  onExport: (id: string) => void;
}) {
  const isLoading = loadingId === session.id;
  const date = new Date(session.lastActivity).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div style={{
      padding: '8px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {session.isActive && (
          <span style={{ width: 6, height: 6, borderRadius: '50%',
            background: 'var(--red)', flexShrink: 0,
            animation: 'pulse 1s ease-in-out infinite' }} />
        )}
        <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={session.label}>
          {session.label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 10, color: 'var(--dim)' }}>
        <span>{session.eventCount} events</span>
        <span>·</span>
        <span>{date}</span>
        <div style={{ flex: 1 }} />
        <ActionBtn
          onClick={() => onExport(session.id)}
          color="var(--dim)"
          label="Export JSONL"
        >
          ↓
        </ActionBtn>
        <ActionBtn
          onClick={() => onLoad(session.id)}
          color="var(--cyan)"
          label="Load session"
          disabled={isLoading}
        >
          {isLoading ? '…' : 'Load'}
        </ActionBtn>
      </div>
    </div>
  );
}

function ActionBtn({
  onClick, color, label, disabled = false, children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        background: 'none', border: `1px solid ${color}44`,
        color, borderRadius: 4, padding: '2px 7px',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 10, fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
