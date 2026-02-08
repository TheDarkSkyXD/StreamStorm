
import { build } from 'vite';
import { resolve } from 'path';

const root = resolve(__dirname, '..');

// Build Main Process
async function buildMain() {
    console.log('Building Main Process...');
    await build({
        configFile: resolve(root, 'vite.main.config.ts'),
        root,
        build: {
            outDir: 'dist/main',
            emptyOutDir: true,
            lib: {
                entry: resolve(root, 'src/main.ts'),
                fileName: () => 'main.js',
                formats: ['cjs'],
            },
            rollupOptions: {
                external: ['electron', 'better-sqlite3', 'path', 'fs', 'os', 'child_process'],
            },
        },
    });
}

// Build Preload Script
async function buildPreload() {
    console.log('Building Preload Script...');
    await build({
        configFile: resolve(root, 'vite.preload.config.ts'),
        root,
        build: {
            outDir: 'dist/preload',
            emptyOutDir: true,
            lib: {
                entry: resolve(root, 'src/preload/index.ts'),
                fileName: () => 'index.js',
                formats: ['cjs'],
            },
            rollupOptions: {
                external: ['electron'],
            },
        },
    });
}

// Build Renderer
async function buildRenderer() {
    console.log('Building Renderer...');
    await build({
        configFile: resolve(root, 'vite.renderer.config.ts'),
        root,
        base: './', // Ensure relative paths for file:// protocol
        build: {
            outDir: 'dist/renderer',
            emptyOutDir: true,
            rollupOptions: {
                input: resolve(root, 'index.html'),
            },
        },
    });
}

async function runBuild() {
    try {
        await buildMain();
        await buildPreload();
        await buildRenderer();
        console.log('✅ Build complete');
    } catch (err) {
        console.error('❌ Build failed:', err);
        process.exit(1);
    }
}

runBuild();
