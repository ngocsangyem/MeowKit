/**
 * Mock-scenario shim for orchviz-web.
 *
 * The full agent-flow distribution ships a demo scenario; orchviz is live-only.
 * We export empty defaults so the simulation hook compiles unchanged while
 * `useMockData` stays false.
 */

import type { SimulationEvent } from "./agent-types";

export const MOCK_SCENARIO: SimulationEvent[] = [];
export const MOCK_DURATION = 0;
