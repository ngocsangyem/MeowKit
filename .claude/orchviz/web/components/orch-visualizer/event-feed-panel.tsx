'use client';

/**
 * OrchViz — Event Feed Panel
 * Sliding right panel showing recent orchestration events with auto-scroll.
 */

import { useEffect, useRef } from 'react';
import type { OrchSimulationState, OrchEvent } from '@/hooks/simulation/types';

interface EventFeedPanelProps {
  state: OrchSimulationState;
  open: boolean;
  onClose: () => void;
}

const EVENT_COLORS: Record<string, string> = {
  agent_spawn: 'var(--cyan)',
  agent_complete: 'var(--emerald)',
  tool_start: 'var(--amber)',
  tool_complete: 'var(--muted)',
  tool_error: 'var(--red)',
  message: 'var(--purple)',
  phase_change: 'var(--cyan)',
  task_update: 'var(--amber)',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function eventLabel(ev: OrchEvent): string {
  const agent = ev.agent?.name ?? '—';
  switch (ev.eventType) {
    case 'agent_spawn':    return `${agent} spawned`;
    case 'agent_complete': return `${agent} completed`;
    case 'tool_start':     return `${agent} → ${ev.toolContext?.name ?? '?'}`;
    case 'tool_complete':  return `${agent} ✓ ${ev.toolContext?.name ?? '?'}`;
    case 'tool_error':     return `${agent} ✗ ${ev.toolContext?.name ?? '?'}`;
    case 'message':        return `${agent}: ${ev.messageContext?.text?.slice(0, 48) ?? ''}`;
    case 'phase_change':   return `Phase → ${ev.workflowStep}`;
    case 'task_update':    return `Task ${ev.taskContext?.id}: ${ev.taskContext?.status}`;
    default:               return `${agent} ${ev.eventType}`;
  }
}

export function EventFeedPanel({ state, open, onClose }: EventFeedPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const recent = state.events.slice(-100);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.events.length, open]);

  return (
    <div style={{
      position: 'fixed', top: 44, right: 0, bottom: 0, width: 280, zIndex: 45,
      background: 'var(--glass)', borderLeft: '1px solid var(--border)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.2s ease',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)',
          textTransform: 'uppercase' }}>Event Feed</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--dim)', fontSize: 14, lineHeight: 1 }}>✕</button>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {recent.map((ev, i) => (
          <div key={`${ev.seq}-${i}`} style={{
            display: 'flex', gap: 8, padding: '5px 14px', alignItems: 'flex-start',
          }}>
            <span style={{ color: 'var(--dim)', fontSize: 9, flexShrink: 0, marginTop: 1,
              fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(ev.timestamp)}
            </span>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 3,
              background: EVENT_COLORS[ev.eventType] ?? 'var(--muted)',
            }} />
            <span style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.4,
              wordBreak: 'break-word' }}>
              {eventLabel(ev)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
