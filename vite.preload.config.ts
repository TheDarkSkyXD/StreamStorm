import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@backend': path.resolve(__dirname, './src/backend'),
            '@frontend': path.resolve(__dirname, './src/frontend'),
            '@shared': path.resolve(__dirname, './src/shared'),
        },
    },
});
