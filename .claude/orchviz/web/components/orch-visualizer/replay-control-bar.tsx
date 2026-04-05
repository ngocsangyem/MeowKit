'use client';

/**
 * OrchViz — Replay Control Bar
 *
 * Review-mode bottom strip: scrubber, transport controls,
 * speed selector, event counter, GO LIVE button.
 * Replaces ControlBar when replay.mode === 'review'.
 */

import type { ReplayState } from '@/hooks/use-replay';

interface ReplayControlBarProps {
  replay: ReplayState;
  onSeek: (index: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onSetSpeed: (speed: number) => void;
  onGoLive: () => void;
}

const SPEEDS = [0.5, 1, 2, 4];

const BAR: React.CSSProperties = {
  position: 'fixed', bottom: 0, left: 140, right: 0, zIndex: 40,
  height: 44, display: 'flex', alignItems: 'center', gap: 10,
  padding: '0 14px',
  background: 'var(--glass)',
  borderTop: '1px solid var(--border)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
};

const BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 5,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--muted)',
  cursor: 'pointer',
  fontSize: 11,
};

export function ReplayControlBar({
  replay, onSeek, onPlay, onPause,
  onStepBackward, onStepForward, onSetSpeed, onGoLive,
}: ReplayControlBarProps) {
  const { cursor, totalEvents, isPlaying, speed } = replay;
  const pct = totalEvents > 0 ? (cursor / (totalEvents - 1)) * 100 : 0;

  return (
    <div style={BAR}>
      {/* REVIEW badge */}
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        color: 'var(--amber)', whiteSpace: 'nowrap' }}>
        REVIEW
      </span>

      <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />

      {/* Transport: step back */}
      <button style={BTN} onClick={onStepBackward} title="Step back (←)" aria-label="Step backward">
        ‹
      </button>

      {/* Play / Pause */}
      <button
        style={{ ...BTN, color: isPlaying ? 'var(--amber)' : 'var(--cyan)', width: 30 }}
        onClick={isPlaying ? onPause : onPlay}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>

      {/* Step forward */}
      <button style={BTN} onClick={onStepForward} title="Step forward (→)" aria-label="Step forward">
        ›
      </button>

      <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(0, totalEvents - 1)}
        value={cursor}
        onChange={e => onSeek(Number(e.target.value))}
        style={{ flex: 1, minWidth: 80, accentColor: 'var(--cyan)', cursor: 'pointer' }}
        aria-label="Event scrubber"
      />

      {/* Counter */}
      <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums', minWidth: 80, textAlign: 'right' }}>
        {cursor + 1} / {totalEvents}
      </span>

      <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />

      {/* Progress bar fill indicator */}
      <span style={{ fontSize: 10, color: 'var(--dim)', minWidth: 34, textAlign: 'right',
        fontVariantNumeric: 'tabular-nums' }}>
        {pct.toFixed(0)}%
      </span>

      <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />

      {/* Speed selector */}
      <div style={{ display: 'flex', gap: 3 }}>
        {SPEEDS.map(s => (
          <button
            key={s}
            onClick={() => onSetSpeed(s)}
            style={{
              ...BTN, width: 32, fontSize: 9, fontWeight: 600,
              color: s === speed ? 'var(--cyan)' : 'var(--dim)',
              borderColor: s === speed ? 'var(--cyan)' : 'var(--border)',
              background: s === speed ? 'rgba(125,211,252,0.08)' : 'transparent',
            }}
            aria-pressed={s === speed}
            aria-label={`Speed ${s}x`}
          >
            {s}x
          </button>
        ))}
      </div>

      <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />

      {/* GO LIVE */}
      <button
        onClick={onGoLive}
        style={{
          ...BTN, width: 'auto', padding: '0 10px',
          color: 'var(--emerald)', borderColor: 'var(--emerald)',
          background: 'rgba(52,211,153,0.08)',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
        }}
        aria-label="Go live"
        title="Exit review mode (R)"
      >
        GO LIVE
      </button>
    </div>
  );
}
