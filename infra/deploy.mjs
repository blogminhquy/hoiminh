// Script deploy: migration lên Supabase → deploy Worker API → build web → deploy Worker web.
// Dùng: node infra/deploy.mjs [--skip-migrate] [--skip-web] [--skip-api]
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
if (!args.has('--skip-api')) run('pnpm --filter @hoiminh/api run deploy');
if (!args.has('--skip-web')) {
  run('pnpm --filter @hoiminh/web build');
  run('pnpm --filter @hoiminh/web run deploy');
}
console.log('\n✔ Deploy xong.');
