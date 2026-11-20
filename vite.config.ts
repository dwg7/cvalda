import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Output: a single docs/index.html with JS and CSS inlined, no hashes in names.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
