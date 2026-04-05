'use client';

/**
 * OrchViz — Top Bar
 * Fixed header: logo, connection status, live stats, view tabs, keyboard hints.
 */

import type { OrchSimulationState } from '@/hooks/simulation/types';

interface TopBarProps {
  state: OrchSimulationState;
  connected: boolean;
  currentView: 'graph' | 'timeline' | 'tasks';
  onViewChange: (v: 'graph' | 'timeline' | 'tasks') => void;
}

const VIEWS = [
  { id: 'graph' as const, label: 'Graph', key: 'G' },
  { id: 'timeline' as const, label: 'Timeline', key: 'T' },
  { id: 'tasks' as const, label: 'Tasks', key: 'K' },
];

export function TopBar({ state, connected, currentView, onViewChange }: TopBarProps) {
  const agentCount = Object.values(state.agents).filter(a => a.status !== 'complete').length;
  const elapsed = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      height: 44, display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 16px',
      background: 'var(--glass)',
      borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* Logo */}
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
        background: 'linear-gradient(90deg, var(--cyan), var(--purple))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        ◆ ORCHVIZ
      </span>

      {/* Connection dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
        background: connected ? 'var(--emerald)' : 'var(--red)',
        animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
      }} />

      <span style={{ width: 1, height: 18, background: 'var(--border)' }} />

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, color: 'var(--muted)', fontSize: 11 }}>
        <Stat label="Agents" value={agentCount} color="var(--cyan)" />
        <Stat label="Events" value={state.eventCount} color="var(--text)" />
        <Stat label="Tools" value={state.toolCount} color="var(--amber)" />
        <Stat label="Cost" value={`$${state.totalCost.toFixed(3)}`} color="var(--emerald)" />
        <Stat label="Time" value={`${mm}:${ss}`} color="var(--muted)" />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 2 }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => onViewChange(v.id)} style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
            border: currentView === v.id ? '1px solid var(--cyan)44' : '1px solid transparent',
            background: currentView === v.id ? 'var(--cyan)18' : 'transparent',
            color: currentView === v.id ? 'var(--cyan)' : 'var(--muted)',
            letterSpacing: '0.05em',
          }}>
            {v.label} <span style={{ opacity: 0.4, fontSize: 9 }}>{v.key}</span>
          </button>
        ))}
      </div>

      <span style={{ color: 'var(--dim)', fontSize: 10 }}>E=feed F=fit Space=pause</span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <span>
      <span style={{ color: 'var(--dim)' }}>{label} </span>
      <span style={{ color, fontWeight: 600 }}>{value}</span>
    </span>
  );
}
