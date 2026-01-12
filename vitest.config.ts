/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    alias: {
      '@/': path.resolve(__dirname, './src') + '/',
      '@backend/': path.resolve(__dirname, './src/backend') + '/',
      '@frontend/': path.resolve(__dirname, './src/frontend') + '/',
      '@shared/': path.resolve(__dirname, './src/shared') + '/',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.tsx', // React components need jsdom
        'src/main.ts',
        'src/preload/**',
        'src/renderer.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './src') + '/',
      '@backend/': path.resolve(__dirname, './src/backend') + '/',
      '@frontend/': path.resolve(__dirname, './src/frontend') + '/',
      '@shared/': path.resolve(__dirname, './src/shared') + '/',
    },
  },
});
