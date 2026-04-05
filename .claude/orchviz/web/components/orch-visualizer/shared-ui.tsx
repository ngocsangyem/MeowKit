'use client';

/**
 * OrchViz — Shared UI Primitives
 * GlassCard, StatusBadge, TierDot — reused across all dashboard panels.
 */

import { tierColor } from '@/lib/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, style, className, onClick }: GlassCardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'glass-in 0.15s ease-out',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--cyan)',
  thinking: 'var(--purple)',
  idle: 'var(--muted)',
  complete: 'var(--emerald)',
  waiting: 'var(--amber)',
  error: 'var(--red)',
  // task statuses
  in_progress: 'var(--cyan)',
  pending: 'var(--amber)',
  completed: 'var(--emerald)',
  blocked: 'var(--red)',
};

interface StatusBadgeProps {
  status: string;
  style?: React.CSSProperties;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] ?? 'var(--muted)';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color,
        background: `${color}22`,
        border: `1px solid ${color}44`,
        ...style,
      }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

interface TierDotProps {
  tier: string;
  size?: number;
  style?: React.CSSProperties;
}

export function TierDot({ tier, size = 8, style }: TierDotProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: tierColor(tier),
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
