import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import manifest from './package.json' with { type: 'json' };
export default defineConfig({
  plugins: [svelte()], base: './',
  define: { __ASTRA_VERSION__: JSON.stringify(manifest.version) },
  build: { outDir: 'dist/renderer', emptyOutDir: true },
});
