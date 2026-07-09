import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/powerbi-proxy': {
        target: 'https://qvkdlrhvglqjfxzbxnqf.supabase.co/functions/v1/powerbi-proxy',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/powerbi-proxy', ''),
      },
    },
  },
});
