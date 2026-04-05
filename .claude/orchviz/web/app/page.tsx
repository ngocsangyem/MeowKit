/**
 * OrchViz — Main Page
 * Entry point: renders the full OrchVisualizer dashboard.
 */

import { OrchVisualizer } from '@/components/orch-visualizer';

// SSE relay server URL — matches the orchviz relay default port
const SSE_URL = 'http://127.0.0.1:3600/events';

export default function Page() {
  return <OrchVisualizer sseUrl={SSE_URL} />;
}
