import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { versionPlugin } from './scripts/version-plugin';

export default defineConfig({
  plugins: [react(), versionPlugin()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true },
  // Bộ mã hóa WebP tìm tệp .wasm bằng đường dẫn tương đối; để Vite gộp sẵn lúc dev thì đường dẫn đó bị lệch.
  optimizeDeps: { exclude: ['@jsquash/webp'] },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 900 },
});
