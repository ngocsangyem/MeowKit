'use client';

/**
 * OrchViz — Replay Engine Hook
 *
 * Manages live/review mode switching, checkpoint-based seeking,
 * and rAF-driven playback. RT2-4: requestAnimationFrame, not setInterval.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { OrchSimulationState } from './simulation/types';
import { createInitialState } from './simulation/types';
import { buildCheckpoints, seekTo, type Checkpoint } from './simulation/checkpoint';
import type { OrchEvent } from './simulation/types';

export interface ReplayState {
  mode: 'live' | 'review';
  events: OrchEvent[];
  checkpoints: Checkpoint[];
  cursor: number;
  isPlaying: boolean;
  speed: number;   // 0.5 | 1 | 2 | 4
  totalEvents: number;
}

const INITIAL_REPLAY: ReplayState = {
  mode: 'live',
  events: [],
  checkpoints: [],
  cursor: 0,
  isPlaying: false,
  speed: 1,
  totalEvents: 0,
};

const EVENT_INTERVAL_MS = 200; // ms between events at 1x speed

export function useReplay(
  orchRef: React.MutableRefObject<OrchSimulationState>,
  setState: (s: OrchSimulationState) => void,
) {
  const [replay, setReplay] = useState<ReplayState>(INITIAL_REPLAY);
  // Stable ref for playback loop to avoid stale closure on cursor
  const replayRef = useRef(replay);
  replayRef.current = replay;

  /** Load a session's events and enter review mode. */
  const loadSession = useCallback((events: OrchEvent[]) => {
    const checkpoints = buildCheckpoints(events);
    const initial = events.length > 0
      ? seekTo(0, events, checkpoints)
      : createInitialState();
    orchRef.current = initial;
    setState(structuredClone(initial));
    setReplay({
      mode: 'review',
      events,
      checkpoints,
      cursor: 0,
      isPlaying: false,
      speed: 1,
      totalEvents: events.length,
    });
  }, [orchRef, setState]);

  /** Seek to an absolute event index. */
  const seek = useCallback((index: number) => {
    const r = replayRef.current;
    if (r.events.length === 0) return;
    const clamped = Math.max(0, Math.min(index, r.events.length - 1));
    const s = seekTo(clamped, r.events, r.checkpoints);
    orchRef.current = s;
    setState(structuredClone(s));
    setReplay(prev => ({ ...prev, cursor: clamped }));
  }, [orchRef, setState]);

  /** rAF-driven playback loop (RT2-4). */
  useEffect(() => {
    if (!replay.isPlaying || replay.mode !== 'review') return;
    let lastTime = performance.now();
    let accumulated = 0;
    let rafId: number;

    function tick(now: number) {
      accumulated += (now - lastTime) * replayRef.current.speed;
      lastTime = now;

      if (accumulated >= EVENT_INTERVAL_MS) {
        const steps = Math.floor(accumulated / EVENT_INTERVAL_MS);
        accumulated -= steps * EVENT_INTERVAL_MS;

        setReplay(r => {
          const next = Math.min(r.cursor + steps, r.events.length - 1);
          const s = seekTo(next, r.events, r.checkpoints);
          orchRef.current = s;
          setState(structuredClone(s));
          const done = next >= r.events.length - 1;
          return { ...r, cursor: next, isPlaying: done ? false : r.isPlaying };
        });
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [replay.isPlaying, replay.mode, orchRef, setState]);

  const goLive = useCallback(() => setReplay(INITIAL_REPLAY), []);
  const play = useCallback(() => setReplay(r => ({ ...r, isPlaying: true })), []);
  const pause = useCallback(() => setReplay(r => ({ ...r, isPlaying: false })), []);
  const setSpeed = useCallback((s: number) => setReplay(r => ({ ...r, speed: s })), []);
  const stepForward = useCallback(() => seek(replayRef.current.cursor + 1), [seek]);
  const stepBackward = useCallback(() => seek(replayRef.current.cursor - 1), [seek]);

  return { replay, loadSession, seek, goLive, play, pause, setSpeed, stepForward, stepBackward };
}
