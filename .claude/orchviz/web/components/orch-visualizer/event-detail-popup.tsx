'use client';

/**
 * OrchViz — Event Detail Popup
 * Floating GlassCard shown on event/tool click. Clamped to viewport.
 * Closes on outside click or Escape.
 */

import { useEffect, useRef } from 'react';
import type { OrchEvent } from '@/hooks/simulation/types';
import { GlassCard } from './shared-ui';

interface EventDetailPopupProps {
  event: OrchEvent | null;
  position: { x: number; y: number };
  onClose: () => void;
}

const POPUP_W = 260;
const POPUP_H = 200; // approximate for clamping

export function EventDetailPopup({ event, position, onClose }: EventDetailPopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!event) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!event) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [event, onClose]);

  if (!event) return null;

  // Clamp to viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.min(position.x + 8, vw - POPUP_W - 8);
  const top  = Math.min(position.y + 8, vh - POPUP_H - 8);

  const isError = event.eventType.toLowerCase().includes('error');
  const ts = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div ref={ref} style={{ position: 'fixed', left, top, zIndex: 80, width: POPUP_W,
      pointerEvents: 'all' }}>
      <GlassCard style={{ padding: 12,
        border: isError ? '1px solid var(--red)55' : '1px solid var(--border)' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            color: isError ? 'var(--red)' : 'var(--cyan)',
            textTransform: 'uppercase' }}>
            {event.eventType}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            color: 'var(--muted)', cursor: 'pointer', fontSize: 14,
            lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <Row label="Time"    value={ts} />
        {event.agent     && <Row label="Agent" value={event.agent.name} />}
        {event.toolContext && (
          <>
            <Row label="Tool"  value={event.toolContext.name} />
            {event.toolContext.filePath  && <Row label="File"   value={event.toolContext.filePath} truncate />}
            {event.toolContext.tokenCost !== null &&
              <Row label="Tokens" value={String(event.toolContext.tokenCost)}
                color="var(--cyan)" />}
          </>
        )}
        {event.messageContext && (
          <div style={{ marginTop: 6, padding: '5px 7px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)', fontSize: 10,
            color: 'var(--muted)', lineHeight: 1.5,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>
            {event.messageContext.text}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function Row({ label, value, color, truncate }: {
  label: string; value: string; color?: string; truncate?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: 'var(--dim)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 10, color: color ?? 'var(--text)', fontWeight: 500,
        overflow: truncate ? 'hidden' : undefined,
        textOverflow: truncate ? 'ellipsis' : undefined,
        whiteSpace: truncate ? 'nowrap' : undefined,
        maxWidth: truncate ? 150 : undefined,
        direction: truncate ? 'rtl' : undefined,
        textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}
