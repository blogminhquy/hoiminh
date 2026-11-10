// globalSetup của vitest cho các gói test trên database mẫu (core, api): tạo bản chụp một lần ở đầu lượt chạy,
// báo đường dẫn cho các tiến trình test qua biến môi trường, xóa khi lượt chạy kết thúc. Xem testing.ts.
import { createTestDbSnapshot, removeTestDbSnapshot, TEST_DB_SNAPSHOT_ENV } from './testing';

export default async function setup(): Promise<() => void> {
  const dir = await createTestDbSnapshot();
  process.env[TEST_DB_SNAPSHOT_ENV] = dir;
  return () => {
    delete process.env[TEST_DB_SNAPSHOT_ENV];
    removeTestDbSnapshot(dir);
  };
}
