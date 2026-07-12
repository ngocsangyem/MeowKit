import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// Independent Vite app for the Visual Plan studio. Mirrors the orchviz-web build
// conventions (single index.js + index.css, minified, no sourcemap) but is a
// separate bundle at dist/visual-plan-web with zero imports from src/orchviz*.
const root = resolve(__dirname, "visual-plan-web");

export default defineConfig({
	root,
	plugins: [react()],
	resolve: {
		alias: { "@": resolve(root, "src") },
	},
	publicDir: false,
	build: {
		outDir: resolve(__dirname, "dist", "visual-plan-web"),
		emptyOutDir: true,
		sourcemap: false,
		minify: true,
		rollupOptions: {
			output: {
				entryFileNames: "index.js",
				assetFileNames: (info) => (info.names?.[0]?.endsWith(".css") ? "index.css" : "[name].[ext]"),
			},
		},
	},
});
