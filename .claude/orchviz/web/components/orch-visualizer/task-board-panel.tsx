'use client';

/**
 * OrchViz — Task Board Panel
 * Full-view kanban: Blocked | Pending | In Progress | Completed
 * Reads from state.tasks (throttled React state, not orchRef).
 */

import type { OrchSimulationState, TaskNode } from '@/hooks/simulation/types';
import { TierDot } from './shared-ui';

interface TaskBoardPanelProps {
  state: OrchSimulationState;
}

const COLUMNS: Array<{
  status: TaskNode['status'];
  label: string;
  color: string;
}> = [
  { status: 'blocked',     label: 'Blocked',     color: 'var(--red)' },
  { status: 'pending',     label: 'Pending',     color: 'var(--amber)' },
  { status: 'in_progress', label: 'In Progress', color: 'var(--cyan)' },
  { status: 'completed',   label: 'Completed',   color: 'var(--emerald)' },
];

export function TaskBoardPanel({ state }: TaskBoardPanelProps) {
  const tasks = Object.values(state.tasks);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12, padding: 16, overflowY: 'auto',
    }}>
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.status);
        return (
          <div key={col.status} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Column header */}
            <div style={{
              padding: '8px 10px',
              borderBottom: `2px solid ${col.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
                color: col.color, textTransform: 'uppercase' }}>
                {col.label}
              </span>
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                background: `${col.color}22`, color: col.color,
                fontSize: 10, fontWeight: 700,
              }}>
                {colTasks.length}
              </span>
            </div>

            {/* Task cards */}
            {colTasks.map(task => (
              <TaskCard key={task.id} task={task} accentColor={col.color} />
            ))}

            {colTasks.length === 0 && (
              <div style={{ color: 'var(--dim)', fontSize: 10, padding: '8px 10px',
                textAlign: 'center', opacity: 0.5 }}>
                — empty —
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, accentColor }: { task: TaskNode; accentColor: string }) {
  return (
    <div style={{
      background: 'var(--node-bg)', border: '1px solid var(--border)',
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: 6, padding: '8px 10px',
    }}>
      <div style={{ fontSize: 9, color: 'var(--dim)', marginBottom: 4,
        fontVariantNumeric: 'tabular-nums' }}>
        #{task.id}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4,
        marginBottom: task.owner ? 6 : 0, wordBreak: 'break-word' }}>
        {task.subject}
      </div>
      {task.owner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <TierDot tier="executor" size={6} />
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>{task.owner}</span>
        </div>
      )}
    </div>
  );
}
