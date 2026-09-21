import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(process.cwd(), 'src'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Lottie only loads for the six aisles without a 3D render, and it is
        // already behind a dynamic import — keeping it out of the main chunk
        // means those bytes are never fetched on a first paint.
        manualChunks: {
          gsap: ['gsap', '@gsap/react'],
          react: ['react', 'react-dom', 'react-router'],
        },
      },
    },
  },
  server: {
    port: 5178,
    open: true,
  },
});
