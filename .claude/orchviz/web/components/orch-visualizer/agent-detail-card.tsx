'use client';

/**
 * OrchViz — Agent Detail Card
 * Floating glassmorphism card showing agent stats on click.
 * Position is clamped to viewport bounds.
 */

import { useEffect, useRef } from 'react';
import type { AgentNode } from '@/lib/orch-types';
import { tierColor } from '@/lib/colors';
import { GlassCard, StatusBadge, TierDot } from './shared-ui';

interface AgentDetailCardProps {
  agent: AgentNode;
  screenX: number;
  screenY: number;
  onClose: () => void;
}

const CARD_W = 220;
const CARD_H = 200;

export function AgentDetailCard({ agent, screenX, screenY, onClose }: AgentDetailCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Clamp to viewport
  const left = Math.min(screenX + 12, window.innerWidth - CARD_W - 12);
  const top  = Math.min(screenY - 20, window.innerHeight - CARD_H - 12);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const color = tierColor(agent.tier);
  const tokenPct = agent.tokensMax > 0 ? Math.min(1, agent.tokensUsed / agent.tokensMax) : 0;
  const elapsed = agent.completeTime
    ? ((agent.completeTime - agent.spawnTime) / 1000).toFixed(1)
    : ((Date.now() - agent.spawnTime) / 1000).toFixed(1);

  return (
    <div ref={ref} style={{ position: 'fixed', left, top, zIndex: 60,
      width: CARD_W, pointerEvents: 'auto' }}>
      <GlassCard style={{ padding: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <TierDot tier={agent.tier} size={10} />
          <span style={{ color, fontWeight: 700, fontSize: 12, flex: 1 }}>{agent.name}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--dim)', fontSize: 12 }}>✕</button>
        </div>

        {/* Status + duration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <StatusBadge status={agent.status} />
          <span style={{ color: 'var(--dim)', fontSize: 10 }}>{elapsed}s</span>
        </div>

        {/* Tool count + current tool */}
        <Row label="Tools" value={String(agent.toolCallCount)} />
        {agent.currentTool && (
          <Row label="Active" value={
            <span>
              <span style={{ display: 'inline-block', animation: 'pulse 1s linear infinite',
                marginRight: 4 }}>⚙</span>
              {agent.currentTool}
            </span>
          } />
        )}

        {/* Token bar */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            fontSize: 9, color: 'var(--muted)', marginBottom: 3 }}>
            <span>Tokens</span>
            <span>{agent.tokensUsed.toLocaleString()} / {agent.tokensMax.toLocaleString()}</span>
          </div>
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${tokenPct * 100}%`,
              background: tokenPct > 0.8 ? 'var(--red)' : color,
              borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Cost */}
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--cyan)' }}>
          Cost: <strong>${agent.cost.toFixed(4)}</strong>
        </div>
      </GlassCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      fontSize: 10, marginBottom: 4 }}>
      <span style={{ color: 'var(--dim)' }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}
