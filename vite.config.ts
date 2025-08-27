import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        background: "src/background.ts",
        content: "src/content.ts",
        popup: "public/index.html",
        main: "src/main.tsx"
      },
      output: {
        entryFileNames: "[name].js"
      }
    },
    emptyOutDir: true,
  },
});
