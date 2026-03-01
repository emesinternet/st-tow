import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBasePath(rawBase: string | undefined): string {
  if (!rawBase) {
    return '/';
  }
  const trimmed = rawBase.trim();
  if (!trimmed) {
    return '/';
  }
  if (trimmed === '/') {
    return '/';
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
