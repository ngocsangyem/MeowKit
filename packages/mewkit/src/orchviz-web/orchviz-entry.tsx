/**
 * orchviz-entry — Vite IIFE entry point. Mounts <AgentVisualizer /> to #root.
 */

import { createRoot } from "react-dom/client";
import { AgentVisualizer } from "./components/agent-visualizer";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/500.css";
import "./styles/globals.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("orchviz-web: #root missing from index.html");
createRoot(rootEl).render(<AgentVisualizer />);
