import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import codegen from 'vite-plugin-graphql-codegen';

const serverPort = Number(process.env.PORT ?? 3001);

export default defineConfig({
  plugins: [codegen(), tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  define: {
    'import.meta.env.VITE_SERVER_PORT': serverPort,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/graphql': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
      '/avatars': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
      },
    },
  },
});
