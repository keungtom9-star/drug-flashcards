import path from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const staticAppFiles = [
  'app-ui.js',
  'service-worker.js',
  'drugs.js',
  'prompts.js',
  'manifest.json',
  'apple-touch-icon.png',
  'icon.png',
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
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), copyStaticAppFiles()],
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            ward: path.resolve(__dirname, 'ward.html'),
            clinical: path.resolve(__dirname, 'drugquiz.html'),
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
