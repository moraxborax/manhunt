import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  // Use relative base './' so builds work at root (localhost, custom domain)
  // and under a subpath (e.g. GitHub Pages /manhunt/) without config changes.
  base: command === 'build' ? './' : '/',
  server: {
    host: true,
    allowedHosts: true,
  },
  plugins: [react(), tailwindcss()],
}));
