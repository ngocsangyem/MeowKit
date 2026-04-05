'use client';

/**
 * OrchViz — Workflow Sidebar
 * Shows MeowKit's 7-phase workflow with live phase highlighting and gate indicators.
 */

import type { OrchSimulationState } from '@/hooks/simulation/types';

const PHASES = [
  { id: 'orient',   label: 'Orient',   num: 0 },
  { id: 'plan',     label: 'Plan',     num: 1 },
  { id: 'test-red', label: 'Test RED', num: 2 },
  { id: 'build',    label: 'Build',    num: 3 },
  { id: 'review',   label: 'Review',   num: 4 },
  { id: 'ship',     label: 'Ship',     num: 5 },
  { id: 'reflect',  label: 'Reflect',  num: 6 },
];

// Gate between plan(1)→test-red(2) and review(4)→ship(5)
const GATES: Record<number, string> = { 2: 'Gate 1', 5: 'Gate 2' };

interface WorkflowSidebarProps {
  state: OrchSimulationState;
}

export function WorkflowSidebar({ state }: WorkflowSidebarProps) {
  const activeIdx = PHASES.findIndex(p => p.id === state.currentPhase);

  return (
    <div style={{
      position: 'fixed', top: 44, left: 0, bottom: 0, width: 140, zIndex: 40,
      background: 'var(--glass)', borderRight: '1px solid var(--border)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      <div style={{ padding: '0 12px 10px', fontSize: 9, letterSpacing: '0.12em',
        color: 'var(--dim)', textTransform: 'uppercase' }}>
        Workflow
      </div>

      {PHASES.map((phase, i) => {
        const isComplete = activeIdx > i;
        const isActive = activeIdx === i;
        const isPending = activeIdx < i;

        return (
          <div key={phase.id}>
            {/* Gate indicator before gated phases */}
            {GATES[i] && (
              <div style={{
                margin: '4px 12px',
                padding: '2px 6px',
                borderRadius: 3,
                fontSize: 9,
                letterSpacing: '0.08em',
                color: 'var(--amber)',
                background: 'rgba(253,186,116,0.08)',
                border: '1px solid rgba(253,186,116,0.2)',
                textAlign: 'center',
              }}>
                ⬡ {GATES[i]}
              </div>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px',
              background: isActive ? 'rgba(125,211,252,0.06)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--cyan)' : '2px solid transparent',
            }}>
              {/* Status icon */}
              {isComplete ? (
                <span style={{ color: 'var(--emerald)', fontSize: 11, width: 16, textAlign: 'center' }}>✓</span>
              ) : isActive ? (
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--cyan)', display: 'inline-block',
                  animation: 'cyan-pulse 1.5s ease-in-out infinite',
                }} />
              ) : (
                <span style={{ color: 'var(--dim)', fontSize: 10, width: 16, textAlign: 'center',
                  fontWeight: 600 }}>{phase.num}</span>
              )}

              <span style={{
                fontSize: 11,
                color: isComplete ? 'var(--emerald)' : isActive ? 'var(--cyan)' : 'var(--dim)',
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.03em',
              }}>
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
