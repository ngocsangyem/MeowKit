'use client';

/**
 * OrchViz — Control Bar
 * Bottom status strip: live badge, event counter, elapsed time, heartbeat, FPS, version.
 */

import { useRef, useState, useEffect } from 'react';
import type { OrchSimulationState } from '@/hooks/simulation/types';

interface ControlBarProps {
  state: OrchSimulationState;
  connected: boolean;
}

const BAR_HEIGHTS = [6, 10, 14, 10, 6]; // heartbeat shape

export function ControlBar({ state, connected }: ControlBarProps) {
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function tick() {
      frameCountRef.current++;
      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const elapsed = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 140, right: 0, zIndex: 40,
      height: 28, display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 16px',
      background: 'var(--glass)',
      borderTop: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      {/* LIVE badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: connected ? 'var(--red)' : 'var(--dim)',
          animation: connected ? 'pulse 1s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          color: connected ? 'var(--red)' : 'var(--dim)' }}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      <Divider />

      {/* Event counter */}
      <Stat label="EVT" value={state.eventCount} />

      <Divider />

      {/* Elapsed */}
      <Stat label="T" value={`${mm}:${ss}`} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Heartbeat bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {BAR_HEIGHTS.map((h, i) => (
          <div key={i} style={{
            width: 3, height: h, borderRadius: 1.5,
            background: connected ? 'var(--emerald)' : 'var(--dim)',
            opacity: connected ? 1 : 0.3,
            animation: connected ? `pulse ${0.8 + i * 0.1}s ease-in-out infinite` : 'none',
          }} />
        ))}
      </div>

      <Divider />

      {/* FPS */}
      <Stat label="FPS" value={fps} color={fps < 30 ? 'var(--red)' : 'var(--emerald)'} />

      <Divider />

      <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: '0.06em' }}>
        ORCHVIZ v0.1
      </span>
    </div>
  );
}

function Divider() {
  return <span style={{ width: 1, height: 14, background: 'var(--border)' }} />;
}

function Stat({ label, value, color = 'var(--muted)' }: {
  label: string; value: string | number; color?: string;
}) {
  return (
    <span style={{ fontSize: 10 }}>
      <span style={{ color: 'var(--dim)' }}>{label} </span>
      <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </span>
  );
}
