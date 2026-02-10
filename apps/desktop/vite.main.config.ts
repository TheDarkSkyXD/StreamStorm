import path from 'path';
import { builtinModules } from 'module';
import { defineConfig } from 'vite';

// All Node.js built-in modules (both bare and node:-prefixed)
const nodeBuiltins = [
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
];

// https://vitejs.dev/config
// Main process config - runs in Node.js environment
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@backend': path.resolve(__dirname, './src/backend'),
            '@frontend': path.resolve(__dirname, './src/frontend'),
            '@shared': path.resolve(__dirname, './src/shared'),
        },
    },
    build: {
        // Target Node.js version used by Electron
        target: 'node20',

        // Disable source maps in production for smaller output
        sourcemap: process.env.NODE_ENV !== 'production',

        rollupOptions: {
            // External native modules - not bundled
            external: ['better-sqlite3', 'electron', ...nodeBuiltins],
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

