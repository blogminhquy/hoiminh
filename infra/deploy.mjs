// Script deploy tay: migration lên Supabase → build giao diện → deploy hoiminh-api (web + API) → deploy hoiminh-jobs
// → hỏi trang live xem đã chạy đúng bản vừa đẩy chưa.
// Dùng: node infra/deploy.mjs [--skip-migrate] [--skip-jobs] [--skip-verify]
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verifyLive } from './verify-live.mjs';

const args = new Set(process.argv.slice(2));
const started = Date.now();
const steps = ['migrate', 'build', 'api', 'jobs', 'verify'].filter((s) => !args.has(`--skip-${s}`));
let done = 0;
const step = (title) => console.log(`\n[${++done}/${steps.length}] ${title}`);
const run = (cmd, cwd = process.cwd()) => {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd, env: process.env });
};
const git = (cmd) => {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

if (!args.has('--skip-migrate')) {
  if (!process.env.DATABASE_DIRECT_URL && !process.env.DATABASE_URL?.startsWith('postgres')) {
    console.error('Cần DATABASE_DIRECT_URL (kết nối trực tiếp Supabase, cổng 5432) để chạy migration. Không có migration mới thì thêm --skip-migrate.');
    process.exit(1);
  }
  step('Áp migration lên database');
  run('pnpm --filter @hoiminh/db migrate');
}
step('Build giao diện');
run('pnpm --filter @hoiminh/web build');
step('Deploy hoiminh-api (giao diện + API)');
run('pnpm --filter @hoiminh/api run deploy');
// Sau hoiminh-api: hàng đợi chỉ có một nơi xử lý, bản cũ của hoiminh-api phải nhả ra trước.
if (!args.has('--skip-jobs')) {
  step('Deploy hoiminh-jobs (cron + hàng đợi)');
  run('pnpm --filter @hoiminh/jobs run deploy');
}
if (!args.has('--skip-verify')) {
  step('Kiểm tra trang live');
  const url = process.env.APP_URL || 'https://hoiminh.com';
  const expectVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  const r = await verifyLive({ url, expectVersion, expectCommit: git('rev-parse HEAD') });
  if (!r.ok) {
    console.error(`\n✘ Đã deploy nhưng ${url} chưa khớp: ${r.problems.join('; ')}.`);
    console.error('Xem bản đang chạy và quay lui ở /he-thong/phien-ban.');
    process.exit(1);
  }
  console.log(`✔ ${url} đang chạy bản ${r.health?.version} (${r.version?.shortCommit ?? '?'}).`);
}
console.log(`\n✔ Deploy xong sau ${Math.round((Date.now() - started) / 1000)} giây.`);
