/**
 * Adversarial corpus for the reject-mode sanitizer. Attack vectors mirror
 * agent-native's security-xss patterns: scheme obfuscation, event handlers,
 * entity-encoding, inline style (fixed position / z-index), embedded frames,
 * SVG script. Zero silent repair — anything the sanitizer would strip rejects.
 */

import { describe, expect, it } from "vitest";
import { checkWireframeHtml } from "../infrastructure/wireframe-sanitizer.js";

const UNSAFE: Record<string, string> = {
	"javascript href": '<a href="javascript:alert(1)">x</a>',
	"tab-obfuscated scheme": '<a href="java\tscript:alert(1)">x</a>',
	"entity-encoded scheme": '<a href="&#106;avascript:alert(1)">x</a>',
	"event handler": '<div onclick="steal()">hi</div>',
	"script tag": "<div>ok</div><script>alert(1)</script>",
	"inline style fixed": '<div style="position:fixed;z-index:99999">x</div>',
	iframe: '<iframe src="http://evil.test"></iframe>',
	"svg script": "<svg><script>alert(1)</script></svg>",
	"img onerror": "<img src=x onerror=alert(1)>",
	form: '<form action="http://evil.test"><input name="p"></form>',
	object: '<object data="evil.swf"></object>',
	"data uri": '<a href="data:text/html,<script>alert(1)</script>">x</a>',
	"protocol-relative href": '<a href="//evil.test/x">x</a>',
};

const SAFE: Record<string, string> = {
	"structural wireframe": '<section class="wf-screen"><header class="wf-topbar"><h1>Title</h1></header></section>',
	"anchor + class": '<a href="#next" class="wf-button">Continue</a>',
	"relative href": '<a href="/dashboard" class="wf-link">Home</a>',
	list: '<ul class="wf-list"><li>One</li><li>Two</li></ul>',
};

describe("checkWireframeHtml — rejects the adversarial corpus", () => {
	for (const [name, html] of Object.entries(UNSAFE)) {
		it(`rejects ${name}`, () => {
			expect(checkWireframeHtml(html).safe).toBe(false);
		});
	}
});

describe("checkWireframeHtml — accepts safe structural markup", () => {
	for (const [name, html] of Object.entries(SAFE)) {
		it(`accepts ${name}`, () => {
			expect(checkWireframeHtml(html).safe).toBe(true);
		});
	}
});
