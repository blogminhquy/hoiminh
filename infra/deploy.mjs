// Script deploy tay: migration lên Supabase → build giao diện → deploy hoiminh-api (web + API) → deploy hoiminh-jobs.
// Dùng: node infra/deploy.mjs [--skip-migrate] [--skip-jobs]
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const run = (cmd, cwd = process.cwd()) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd, env: process.env });
};

if (!args.has('--skip-migrate')) {
  if (!process.env.DATABASE_DIRECT_URL && !process.env.DATABASE_URL?.startsWith('postgres')) {
    console.error('Cần DATABASE_DIRECT_URL (kết nối trực tiếp Supabase, cổng 5432) để chạy migration.');
    process.exit(1);
  }
  run('pnpm --filter @hoiminh/db migrate');
}
run('pnpm --filter @hoiminh/web build');
run('pnpm --filter @hoiminh/api run deploy');
// Sau hoiminh-api: hàng đợi chỉ có một nơi xử lý, bản cũ của hoiminh-api phải nhả ra trước.
if (!args.has('--skip-jobs')) run('pnpm --filter @hoiminh/jobs run deploy');
console.log('\n✔ Deploy xong.');
