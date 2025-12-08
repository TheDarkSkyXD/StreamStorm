import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig(async () => {
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
  };
});
