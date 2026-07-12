/**
 * Studio entry point — mounts VisualPlanApp into #root. Imports the scoped
 * stylesheet (editor shell + `.wf-root` wireframe theme).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VisualPlanApp } from "./app/visual-plan-app.js";
// Self-hosted hand-drawn font for sketch mode (bundled woff2, no CDN). Excalifont
// has no npm package; Architects Daughter (OFL) is the self-hosted stand-in.
import "@fontsource/architects-daughter";
import "./styles/studio.css";

const el = document.getElementById("root");
if (el) {
	createRoot(el).render(
		<StrictMode>
			<VisualPlanApp />
		</StrictMode>,
	);
}
