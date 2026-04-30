import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(__dirname, "src", "orchviz-web");

export default defineConfig({
	root,
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": root },
	},
	publicDir: false,
	define: {
		"process.env.NODE_ENV": '"production"',
		"process.env.NEXT_PUBLIC_DEMO": '"0"',
		"process.env.NEXT_PUBLIC_RELAY_PORT": '""',
		"process.env.MEWKIT_STANDALONE": '"1"',
	},
	build: {
		outDir: resolve(__dirname, "dist", "orchviz-web"),
		emptyOutDir: true,
		sourcemap: false,
		minify: true,
		rollupOptions: {
			output: {
				entryFileNames: "index.js",
				assetFileNames: (info) => {
					if (info.names?.[0]?.endsWith(".css")) return "index.css";
					return "[name].[ext]";
				},
			},
		},
	},
});
