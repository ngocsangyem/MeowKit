'use client';

/**
 * OrchViz — Main Orchestrator Component
 * Wires all hooks and sub-components into a working dashboard.
 * Keyboard shortcuts: G=graph T=timeline K=tasks E=feed F=fit P=plan B=bottlenecks
 *   Space=play/pause (review) or sim-pause (live)  R=sessions  Esc=close
 */

import { useState, useEffect, useCallback } from 'react';
import { useSSEBridge } from '@/hooks/use-sse-bridge';
import { useOrchSimulation } from '@/hooks/use-orch-simulation';
import { useReplay } from '@/hooks/use-replay';
import { useCanvasCamera } from '@/hooks/use-canvas-camera';
import { useForceLayout } from '@/hooks/use-force-layout';
import { useBottleneckDetection } from '@/hooks/use-bottleneck-detection';
import type { AgentNode } from '@/lib/orch-types';
import type { OrchEvent } from '@/hooks/simulation/types';
import { TopBar } from './top-bar';
import { WorkflowSidebar } from './workflow-sidebar';
import { NodeGraphCanvas } from './node-graph-canvas';
import { EventFeedPanel } from './event-feed-panel';
import { AgentDetailCard } from './agent-detail-card';
import { TaskBoardPanel } from './task-board-panel';
import { ControlBar } from './control-bar';
import { ReplayControlBar } from './replay-control-bar';
import { SessionBrowser } from './session-browser';
import { PlanOverlayPanel } from './plan-overlay-panel';
import { EventDetailPopup } from './event-detail-popup';

type View = 'graph' | 'timeline' | 'tasks';

interface OrchVisualizerProps {
  sseUrl: string;
}

export function OrchVisualizer({ sseUrl }: OrchVisualizerProps) {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  const [height, setHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);

  const bridge = useSSEBridge(sseUrl);
  // useOrchSimulation exposes setState indirectly via the returned state setter
  // We need direct access to setState to hand off to useReplay
  const { orchRef, state, setState } = useOrchSimulation(bridge);
  const { replay, loadSession, seek, goLive, play, pause, setSpeed, stepForward, stepBackward } =
    useReplay(orchRef, setState);
  const { transformRef, handlePanStart, handlePanMove, handlePanEnd, handleZoom, zoomToFit } =
    useCanvasCamera();
  useForceLayout(orchRef, width, height);

  const [currentView, setCurrentView] = useState<View>('graph');
  const [feedOpen, setFeedOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentNode | null>(null);
  const [selectedPos, setSelectedPos] = useState({ x: 0, y: 0 });
  const [, setHoveredAgent] = useState<AgentNode | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showBottlenecks, setShowBottlenecks] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<OrchEvent | null>(null);
  const [eventPopupPos, setEventPopupPos] = useState({ x: 0, y: 0 });

  const isReview = replay.mode === 'review';

  const bottleneckMarkers = useBottleneckDetection(
    state.agents,
    state.tasks,
    state.lastEventTime,
    showBottlenecks,
  );

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
        case 'P': setShowPlan(o => !o); break;
        case 'B': setShowBottlenecks(o => !o); break;
        case 'R': setShowSessionBrowser(o => !o); break;
        case ' ':
          e.preventDefault();
          if (isReview) {
            replay.isPlaying ? pause() : play();
          } else {
            setPaused(p => !p);
          }
          break;
        case 'ESCAPE':
          setSelectedAgent(null);
          setSelectedEvent(null);
          setFeedOpen(false);
          setShowPlan(false);
          setShowSessionBrowser(false);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orchRef, zoomToFit, isReview, replay.isPlaying, play, pause]);

  const handleSelectAgent = useCallback((agent: AgentNode | null, sx: number, sy: number) => {
    setSelectedAgent(agent);
    setSelectedPos({ x: sx, y: sy });
  }, []);

  const handleHoverAgent = useCallback((agent: AgentNode | null) => {
    setHoveredAgent(agent);
  }, []);

  // Exposed for future event-feed → popup wiring (EventFeedPanel can call this)
  const handleSelectEventAtPos = useCallback((event: OrchEvent | null, x: number, y: number) => {
    setSelectedEvent(event);
    setEventPopupPos({ x, y });
  }, []);
  void handleSelectEventAtPos; // consumed by EventDetailPopup; wire to EventFeedPanel when needed

  // Canvas area: left=140 (sidebar), top=44 (topbar), bottom=28 (controlbar)
  const rightOffset = feedOpen ? 280 : showPlan ? 300 : 0;
  const canvasStyle: React.CSSProperties = {
    position: 'fixed',
    left: 140, top: 44,
    right: rightOffset,
    bottom: 28,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <TopBar
        state={state}
        connected={bridge.connected}
        currentView={currentView}
        onViewChange={setCurrentView}
        showPlan={showPlan}
        onTogglePlan={() => setShowPlan(o => !o)}
        showBottlenecks={showBottlenecks}
        onToggleBottlenecks={() => setShowBottlenecks(o => !o)}
        bottleneckCount={bottleneckMarkers.length}
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
            bottleneckMarkers={bottleneckMarkers}
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

      {/* Session browser (slide-in from right) */}
      <SessionBrowser
        visible={showSessionBrowser}
        onClose={() => setShowSessionBrowser(false)}
        onLoadSession={loadSession}
      />

      {/* Plan overlay */}
      <PlanOverlayPanel
        visible={showPlan}
        plan={state.plan}
        agents={state.agents}
        onClose={() => setShowPlan(false)}
      />

      {/* Floating agent detail */}
      {selectedAgent && (
        <AgentDetailCard
          agent={selectedAgent}
          screenX={selectedPos.x}
          screenY={selectedPos.y}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Event detail popup */}
      <EventDetailPopup
        event={selectedEvent}
        position={eventPopupPos}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Bottom bar: review mode shows scrubber, live shows status strip */}
      {isReview ? (
        <ReplayControlBar
          replay={replay}
          onSeek={seek}
          onPlay={play}
          onPause={pause}
          onStepBackward={stepBackward}
          onStepForward={stepForward}
          onSetSpeed={setSpeed}
          onGoLive={goLive}
        />
      ) : (
        <ControlBar
          state={state}
          connected={bridge.connected}
          onOpenSessions={() => setShowSessionBrowser(o => !o)}
        />
      )}
    </div>
  );
}
