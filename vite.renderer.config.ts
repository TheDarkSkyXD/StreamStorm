import { defineConfig, type UserConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig(async (): Promise<UserConfig> => {
  const react = (await import('@vitejs/plugin-react')).default;

  const isProduction = process.env.NODE_ENV === 'production';

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
      sourcemap: !isProduction,

      // Optimize minification
      minify: 'esbuild',

      // CSS code splitting - separate CSS per async chunk for faster initial load
      cssCodeSplit: true,

      // Inline small assets (< 4KB) as base64 to reduce HTTP requests
      // Larger assets remain as files for better caching
      assetsInlineLimit: 4096,

      // Chunk size warning threshold (helps identify bloated chunks)
      chunkSizeWarningLimit: 500,

      // Enable tree-shaking for side-effect-free modules
      rollupOptions: {
        treeshake: {
          moduleSideEffects: 'no-external',
          propertyReadSideEffects: false,
          // Aggressively remove unused exports
          tryCatchDeoptimization: false,
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
            // Utility libraries chunk
            'vendor-utils': [
              'clsx',
              'tailwind-merge',
              'class-variance-authority',
            ],
          },
          // Optimize chunk file names for caching
          chunkFileNames: isProduction
            ? 'assets/[name]-[hash].js'
            : 'assets/[name].js',
          assetFileNames: isProduction
            ? 'assets/[name]-[hash][extname]'
            : 'assets/[name][extname]',
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
        'clsx',
        'tailwind-merge',
        'class-variance-authority',
        'lucide-react',
      ],
      // Exclude native modules that should be handled by Electron
      exclude: ['better-sqlite3'],
    },
    // Electron-specific optimizations
    esbuild: {
      // Drop debugger statements in production builds
      drop: isProduction ? ['debugger'] : [],
      // Remove console.debug in production (keeps log/warn/error)
      pure: isProduction ? ['console.debug'] : [],
      // Minification settings for smaller output
      minifyIdentifiers: isProduction,
      minifySyntax: isProduction,
      minifyWhitespace: isProduction,
    },
    // CSS optimization
    css: {
      // Enable CSS modules for scoped styles (when using .module.css)
      modules: {
        localsConvention: 'camelCase',
      },
      // PostCSS is already configured via postcss.config.js (Tailwind)
    },
  };
});
