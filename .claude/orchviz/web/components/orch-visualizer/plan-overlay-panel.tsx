'use client';

/**
 * OrchViz — Plan Execution Overlay Panel
 * Sliding panel from right showing plan phase progress.
 */

import { useMemo } from 'react';
import type { PlanState } from '@/hooks/simulation/types';
import type { AgentNode } from '@/lib/orch-types';

interface PlanOverlayPanelProps {
  visible: boolean;
  plan: PlanState | null;
  agents: Record<string, AgentNode>;
  onClose: () => void;
}

const PHASE_ICON: Record<string, string> = {
  complete:    '✓',
  completed:   '✓',
  in_progress: '▶',
  active:      '▶',
};

const PHASE_COLOR: Record<string, string> = {
  complete:    'var(--emerald)',
  completed:   'var(--emerald)',
  in_progress: 'var(--cyan)',
  active:      'var(--cyan)',
};

function phaseIcon(status: string): string  { return PHASE_ICON[status]  ?? '○'; }
function phaseColor(status: string): string { return PHASE_COLOR[status] ?? 'var(--dim)'; }

export function PlanOverlayPanel({ visible, plan, onClose }: PlanOverlayPanelProps) {
  const phases = useMemo(() => plan?.phases ?? [], [plan]);

  return (
    <div style={{
      position: 'fixed', top: 44, right: 0, bottom: 28,
      width: 300,
      transform: visible ? 'translateX(0)' : 'translateX(300px)',
      transition: 'transform 0.22s ease',
      background: 'var(--glass)',
      borderLeft: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: 40,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          color: 'var(--cyan)' }}>PLAN EXECUTION</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none',
          color: 'var(--muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1,
          padding: 0 }}>×</button>
      </div>

      {!plan ? (
        <div style={{ padding: 16, color: 'var(--dim)', fontSize: 11 }}>No plan loaded</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex',
          flexDirection: 'column', gap: 12 }}>
          {/* Overall progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
              <span>Overall</span>
              <span style={{ color: 'var(--cyan)' }}>{Math.round(plan.overallProgress * 100)}%</span>
            </div>
            <ProgressBar value={plan.overallProgress} color="var(--cyan)" />
          </div>

          {/* Phases */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {phases.map(phase => {
              const color = phaseColor(phase.status);
              const icon  = phaseIcon(phase.status);
              const isPulse = phase.status === 'in_progress' || phase.status === 'active';
              return (
                <div key={phase.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color, fontSize: 11, flexShrink: 0, width: 12,
                      animation: isPulse ? 'pulse 1.5s ease-in-out infinite' : 'none' }}>
                      {icon}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      flex: 1 }}>
                      {phase.title}
                    </span>
                  </div>
                  <ProgressBar
                    value={phase.status === 'completed' || phase.status === 'complete' ? 1 :
                           isPulse ? 0.5 : 0}
                    color={color}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(1, Math.max(0, value)) * 100}%`,
        background: color, borderRadius: 2, transition: 'width 0.3s ease' }} />
    </div>
  );
}
