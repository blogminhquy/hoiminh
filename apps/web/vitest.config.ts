import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Riêng khỏi vite.config.ts để test không chạy versionPlugin. Test chạy trên Node, không cần DOM.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
