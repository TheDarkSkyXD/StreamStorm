import { defineConfig } from 'vite';

// https://vitejs.dev/config
// Main process config - runs in Node.js environment
export default defineConfig({
    build: {
        // Target Node.js version used by Electron
        target: 'node20',

        // Disable source maps in production for smaller output
        sourcemap: process.env.NODE_ENV !== 'production',

        rollupOptions: {
            // External native modules - not bundled
            external: ['better-sqlite3', 'electron'],
        },
    },
    // Electron-specific optimizations for main process
    esbuild: {
        // Drop debugger statements in production
        drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
        // Remove console.debug in production
        pure: process.env.NODE_ENV === 'production' ? ['console.debug'] : [],
    },
});
