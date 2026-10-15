import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        // Bibliotecas de UI num chunk próprio: garante que o React seja inicializado antes dos
        // chunks do editor (evita ciclos entre o bundle principal e os chunks sob demanda).
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|radix-ui|@radix-ui|lucide-react|zustand|use-sync-external-store)[\\/]/, priority: 20 },
            { name: 'vendor-media', test: /node_modules[\\/](mediabunny|immer|fflate)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  worker: { format: 'es' },
});
