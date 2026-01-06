import { defineConfig, type UserConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig(async (): Promise<UserConfig> => {
  const react = (await import('@vitejs/plugin-react')).default;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@backend': path.resolve(__dirname, './src/backend'),
        '@frontend': path.resolve(__dirname, './src/frontend'),
        '@shared': path.resolve(__dirname, './src/shared'),
      },
    },
    build: {
      // Target modern Chromium (Electron) - no need for legacy polyfills
      // This significantly reduces bundle size by avoiding unnecessary transforms
      target: 'esnext',

      // Disable source maps in production for smaller bundles
      sourcemap: process.env.NODE_ENV !== 'production',

      // Optimize minification
      minify: 'esbuild',

      // Enable tree-shaking for side-effect-free modules
      rollupOptions: {
        treeshake: {
          moduleSideEffects: 'no-external',
          propertyReadSideEffects: false,
        },
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks for stable dependencies
            'vendor-react': ['react', 'react-dom'],
            'vendor-router': ['@tanstack/react-router'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-select',
              '@radix-ui/react-switch',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-progress',
              '@radix-ui/react-slot',
            ],
            'vendor-motion': ['framer-motion'],
            'vendor-hls': ['hls.js'],
            'vendor-dnd': [
              '@dnd-kit/core',
              '@dnd-kit/sortable',
              '@dnd-kit/utilities',
            ],
          },
        },
      },
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
      // Pre-bundle these for faster dev startup
      include: [
        'react',
        'react-dom',
        '@tanstack/react-query',
        '@tanstack/react-router',
        'zustand',
        'hls.js',
        'framer-motion',
      ],
      // Exclude native modules that should be handled by Electron
      exclude: ['better-sqlite3'],
    },
    // Electron-specific optimizations
    esbuild: {
      // Drop debugger statements in production builds
      drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
      // Preserve console.debug for development but not production
      pure: process.env.NODE_ENV === 'production' ? ['console.debug'] : [],
    },
  };
});
