import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
// Preload script config - runs in isolated context bridging main<->renderer
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@backend': path.resolve(__dirname, './src/backend'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  build: {
    // Target modern Chromium for minimal output
    target: 'esnext',

    // Disable source maps in production for smaller output
    sourcemap: process.env.NODE_ENV !== 'production',

    // Minimize preload script size (runs on every window/frame)
    minify: 'esbuild',

    rollupOptions: {
      // External Electron APIs - not bundled
      external: ['electron'],

      output: {
        // Inline small chunks for faster load
        inlineDynamicImports: true,
      },
    },
  },
  // Production optimizations
  esbuild: {
    // Drop debugger statements in production
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    // Remove console.debug in production
    pure: process.env.NODE_ENV === 'production' ? ['console.debug'] : [],
  },
});
