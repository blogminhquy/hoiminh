import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

// Mỗi file test mở một PGlite riêng trong bộ nhớ nên các file chạy song song được (mỗi file một tiến trình).
// Mặc định vitest để dành một nhân (máy CI 2 nhân thì chỉ còn một luồng); test ở đây nặng CPU nên dùng hết số nhân.
// globalSetup dựng database mẫu một lần cho cả lượt; từng file nạp lại từ bản chụp đó (xem @hoiminh/db/testing).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    globalSetup: ['../../packages/db/src/testing-global-setup.ts'],
    maxWorkers: availableParallelism(),
    minWorkers: 1,
  },
});
