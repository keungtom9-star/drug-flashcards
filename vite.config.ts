import path from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const staticAppFiles = [
  'app-ui.js',
  'ios-polish.css',
  'service-worker.js',
  'drugs.js',
  'prompts.js',
  'manifest.json',
  'apple-touch-icon.png',
  'icon.png',
];

const requiredBuildFiles = [
  'index.html',
  'ward.html',
  'drugquiz.html',
  'app-ui.js',
  'ios-polish.css',
  'service-worker.js',
  'manifest.json',
];

const copyStaticAppFiles = () => ({
  name: 'copy-static-app-files',
  closeBundle() {
    const outputDir = path.resolve(__dirname, 'dist');
    mkdirSync(outputDir, { recursive: true });
    for (const file of staticAppFiles) {
      const source = path.resolve(__dirname, file);
      if (existsSync(source)) copyFileSync(source, path.resolve(outputDir, file));
    }
    const missing = requiredBuildFiles.filter(file => !existsSync(path.resolve(outputDir, file)));
    if (missing.length) throw new Error(`Incomplete production build. Missing: ${missing.join(', ')}`);
  },
});

const keepManifestAtAppRoot = () => ({
  name: 'keep-manifest-at-app-root',
  enforce: 'post' as const,
  transformIndexHtml: {
    order: 'post' as const,
    handler(html: string) {
      return html.replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/gi, tag =>
        tag.replace(/\bhref=["'][^"']*["']/i, 'href="manifest.json"')
      );
    },
  },
});

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), copyStaticAppFiles(), keepManifestAtAppRoot()],
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            ward: path.resolve(__dirname, 'ward.html'),
            clinical: path.resolve(__dirname, 'drugquiz.html'),
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
