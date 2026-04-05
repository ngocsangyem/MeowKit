'use client';

/**
 * OrchViz — Main Orchestrator Component
 * Wires all hooks and sub-components into a working dashboard.
 * Keyboard shortcuts: G=graph T=timeline K=tasks E=feed F=fit Space=pause Esc=close
 */

import { useState, useEffect, useCallback } from 'react';
import { useSSEBridge } from '@/hooks/use-sse-bridge';
import { useOrchSimulation } from '@/hooks/use-orch-simulation';
import { useCanvasCamera } from '@/hooks/use-canvas-camera';
import { useForceLayout } from '@/hooks/use-force-layout';
import type { AgentNode } from '@/lib/orch-types';
import { TopBar } from './top-bar';
import { WorkflowSidebar } from './workflow-sidebar';
import { NodeGraphCanvas } from './node-graph-canvas';
import { EventFeedPanel } from './event-feed-panel';
import { AgentDetailCard } from './agent-detail-card';
import { TaskBoardPanel } from './task-board-panel';
import { ControlBar } from './control-bar';

type View = 'graph' | 'timeline' | 'tasks';

interface OrchVisualizerProps {
  sseUrl: string;
}

export function OrchVisualizer({ sseUrl }: OrchVisualizerProps) {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  const [height, setHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  const bridge = useSSEBridge(sseUrl);
  const { orchRef, state } = useOrchSimulation(bridge);
  const { transformRef, handlePanStart, handlePanMove, handlePanEnd, handleZoom, zoomToFit } =
    useCanvasCamera();
  useForceLayout(orchRef, width, height);

  const [currentView, setCurrentView] = useState<View>('graph');
  const [feedOpen, setFeedOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [selectedPos, setSelectedPos] = useState({ x: 0, y: 0 });
  const [, setHoveredAgent] = useState<AgentNode | null>(null);

  // Track viewport size
  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toUpperCase()) {
        case 'G': setCurrentView('graph'); break;
        case 'T': setCurrentView('timeline'); break;
        case 'K': setCurrentView('tasks'); break;
        case 'E': setFeedOpen(o => !o); break;
        case 'F': zoomToFit(Object.values(orchRef.current.agents)); break;
        case ' ': e.preventDefault(); setPaused(p => !p); break;
        case 'ESCAPE': setSelectedAgent(null); setFeedOpen(false); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orchRef, zoomToFit]);

  const handleSelectAgent = useCallback((agent: AgentNode | null, sx: number, sy: number) => {
    setSelectedAgent(agent);
    setSelectedPos({ x: sx, y: sy });
  }, []);

  const handleHoverAgent = useCallback((agent: AgentNode | null) => {
    setHoveredAgent(agent);
  }, []);

  // Canvas area: left=140 (sidebar), top=44 (topbar), bottom=28 (controlbar)
  const canvasStyle: React.CSSProperties = {
    position: 'fixed',
    left: 140, top: 44,
    right: feedOpen ? 280 : 0,
    bottom: 28,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <TopBar
        state={state}
        connected={bridge.connected}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <WorkflowSidebar state={state} />

      {/* Main view area */}
      <div style={canvasStyle}>
        {currentView === 'graph' ? (
          <NodeGraphCanvas
            orchRef={orchRef}
            transformRef={transformRef}
            onSelectAgent={handleSelectAgent}
            onHoverAgent={handleHoverAgent}
            onPanStart={handlePanStart}
            onPanMove={handlePanMove}
            onPanEnd={handlePanEnd}
            onZoom={handleZoom}
            paused={paused}
          />
        ) : currentView === 'tasks' ? (
          <div style={{ position: 'relative', width: '100%', height: '100%',
            overflowY: 'auto' }}>
            <TaskBoardPanel state={state} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--dim)', fontSize: 12 }}>
            Timeline view — coming soon
          </div>
        )}
      </div>

      {/* Right panel */}
      <EventFeedPanel state={state} open={feedOpen} onClose={() => setFeedOpen(false)} />

      {/* Floating agent detail */}
      {selectedAgent && (
        <AgentDetailCard
          agent={selectedAgent}
          screenX={selectedPos.x}
          screenY={selectedPos.y}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      <ControlBar state={state} connected={bridge.connected} />
    </div>
  );
}
