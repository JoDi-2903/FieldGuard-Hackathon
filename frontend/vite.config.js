import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// During `npm run dev` the app calls `/api/*`; proxy those to a Functions backend
// so local development mirrors the production same-origin setup. In production the
// Static Web App serves the build and proxies `/api` to the linked Function App.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY || 'http://localhost:7071';
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
  };
});
