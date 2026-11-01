import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Fail loudly rather than silently moving to 5174, which would break the
    // backend's CORS allowlist and produce a confusing error later.
    strictPort: true,
  },
  build: { outDir: 'dist', sourcemap: true },
});
