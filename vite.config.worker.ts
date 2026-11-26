import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// Worker migration build: keep the existing Pages build untouched.
// Static PWA files are emitted separately from the compiled Pages Functions bundle.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
});
