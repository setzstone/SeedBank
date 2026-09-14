import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Source lives in app/, the built single-file page lands in docs/ so GitHub
// Pages can serve it straight from the repo (Settings → Pages → /docs).
export default defineConfig({
  root: 'app',
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: '../docs', emptyOutDir: true, target: 'esnext', minify: true }
});
