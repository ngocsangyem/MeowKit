/**
 * OrchViz — Checkpoint System
 *
 * Builds state snapshots every N events for fast O(log N + K) seeking.
 * RT2-1: structuredClone for snapshots.
 */

import type { OrchSimulationState } from './types';
import { createInitialState } from './types';
import { processEvent } from './process-event';
import type { OrchEvent } from './types';

const CHECKPOINT_INTERVAL = 500;

export interface Checkpoint {
  eventIndex: number;
  snapshot: OrchSimulationState;
}

/** Build checkpoints every CHECKPOINT_INTERVAL events for fast seeking. */
export function buildCheckpoints(events: OrchEvent[]): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];
  const state = createInitialState();

  for (let i = 0; i < events.length; i++) {
    processEvent(state, events[i]);
    if (i % CHECKPOINT_INTERVAL === 0) {
      checkpoints.push({ eventIndex: i, snapshot: structuredClone(state) });
    }
  }

  return checkpoints;
}

/**
 * Seek to a specific event index using nearest checkpoint.
 * Binary search → O(log C) checkpoint lookup + O(K) replay from checkpoint.
 */
export function seekTo(
  index: number,
  events: OrchEvent[],
  checkpoints: Checkpoint[],
): OrchSimulationState {
  if (checkpoints.length === 0) {
    const state = createInitialState();
    for (let i = 0; i <= index && i < events.length; i++) {
      processEvent(state, events[i]);
    }
    return state;
  }

  // Binary search for nearest checkpoint <= index
  let lo = 0;
  let hi = checkpoints.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (checkpoints[mid].eventIndex <= index) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const cp = checkpoints[best];
  const state = structuredClone(cp.snapshot);

  for (let i = cp.eventIndex + 1; i <= index && i < events.length; i++) {
    processEvent(state, events[i]);
  }

  return state;
}
