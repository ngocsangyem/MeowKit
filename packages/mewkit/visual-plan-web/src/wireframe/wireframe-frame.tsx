/**
 * Renders a frame's semantic-HTML wireframe into a scoped `.wf-root` container.
 *
 * The HTML is re-sanitized at render time (defense in depth) and only the
 * SANITIZED output is injected via dangerouslySetInnerHTML. All wireframe CSS is
 * scoped under `.wf-root` so generated markup can never style the editor shell.
 */

import { useMemo } from "react";
import { sanitizeWireframe } from "./sanitize.js";

export function WireframeFrame({ html }: { html: string }) {
	const safe = useMemo(() => sanitizeWireframe(html).html, [html]);
	return <div className="wf-root" dangerouslySetInnerHTML={{ __html: safe }} />;
}
