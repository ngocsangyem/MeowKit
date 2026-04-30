/**
 * orchviz-entry — Vite IIFE entry point. Mounts <AgentVisualizer /> to #root.
 */

import { createRoot } from "react-dom/client";
import { AgentVisualizer } from "./components/agent-visualizer";
import "./styles/globals.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("orchviz-web: #root missing from index.html");
createRoot(rootEl).render(<AgentVisualizer />);
