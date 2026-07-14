/**
 * Studio entry point — mounts VisualPlanApp into #root. Imports the shell
 * stylesheet and injects the SHARED wireframe theme (the same CSS string the
 * `export --format html` page embeds — one theme, no studio/export drift).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { VisualPlanApp } from "./app/visual-plan-app.js";
// Self-hosted hand-drawn font for sketch mode (bundled woff2, no CDN). Excalifont
// has no npm package; Architects Daughter (OFL) is the self-hosted stand-in.
import "@fontsource/architects-daughter";
import "./styles/studio.css";
// Shared wireframe theme — same import direction as the sanitizer config.
import { WIREFRAME_THEME_CSS } from "../../src/visual-plan/domain/wireframe-theme.js";

const wfStyle = document.createElement("style");
wfStyle.setAttribute("data-wf-theme", "");
wfStyle.textContent = WIREFRAME_THEME_CSS;
document.head.appendChild(wfStyle);

const el = document.getElementById("root");
if (el) {
	createRoot(el).render(
		<StrictMode>
			<VisualPlanApp />
		</StrictMode>,
	);
}
