import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  base: "",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      input: {
        // rename the entry key from "index" to "popup"
        popup: resolve(__dirname, "index.html"),         // ← your popup HTML at project root
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
        offscreen_script: resolve(__dirname, "src/offscreen.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          switch (chunk.name) {
            case "popup": return "popup.js";               // ← popup bundle (no longer index.js)
            case "background": return "background.js";
            case "content": return "content.js";
            case "offscreen_script": return "offscreen.js";
            default: return "chunks/[name].js";            // any split chunks (may include chunks/index.js)
          }
        },
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
