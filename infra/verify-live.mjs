#!/usr/bin/env node
// Kiểm tra trang đang chạy thật sau khi deploy: không tin "wrangler báo xong" mà hỏi thẳng trang live.
//   /health        phải trả status "ok" (database nối được) và đúng số phiên bản, nếu có --version.
//   /version.json  phải đúng commit vừa deploy, nếu có --commit.
// Cloudflare cần vài giây để bản mới chạy ở mọi nơi, nên hỏi lại mỗi 5 giây cho tới khi khớp hoặc hết giờ.
// Dùng: node infra/verify-live.mjs [--url https://hoiminh.com] [--commit <sha>] [--version 1.14.1] [--timeout 90]
// Thoát mã 0 khi khớp, mã 1 khi hết giờ mà vẫn chưa khớp.

/** Đọc `--tên giá-trị` thành object. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[a.slice(2)] = 'true';
    else out[a.slice(2)] = argv[++i];
  }
  return out;
}

/**
 * So thông tin trang live với bản mong đợi. Trả về danh sách điều chưa khớp (rỗng là khớp).
 * `health` và `version` là JSON đã đọc được, hoặc null khi không đọc được.
 */
export function compare({ health, version, expectCommit, expectVersion, why = {} }) {
  const problems = [];
  if (!health) problems.push(`không đọc được /health${why['/health'] ? ` (${why['/health']})` : ''}`);
  else {
    if (health.status !== 'ok') problems.push(`/health báo "${health.status}" (database: ${health.db ?? 'không rõ'})`);
    if (expectVersion && health.version !== expectVersion) problems.push(`API đang ở bản ${health.version ?? '?'}, chưa phải ${expectVersion}`);
  }
  if (expectCommit) {
    const live = version?.shortCommit ?? '';
    if (!version) problems.push(`không đọc được /version.json${why['/version.json'] ? ` (${why['/version.json']})` : ''}`);
    else if (!live || !(expectCommit.startsWith(live) || live.startsWith(expectCommit))) problems.push(`giao diện đang ở commit ${live || '?'}, chưa phải ${expectCommit.slice(0, 7)}`);
  }
  return problems;
}

/** Đọc JSON; không đọc được thì trả null và ghi lý do (mã HTTP hoặc lỗi mạng) vào `why` để báo cho rõ. */
async function readJson(url, why) {
  let status = 0;
  try {
    const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { headers: { 'cache-control': 'no-cache', 'user-agent': 'hoiminh-deploy-check' }, signal: AbortSignal.timeout(10_000) });
    status = r.status;
    return await r.json();
  } catch (err) {
    why[new URL(url).pathname] = status ? `HTTP ${status}, không phải JSON` : `lỗi mạng: ${err instanceof Error ? err.message : String(err)}`;
    return null;
  }
}

export async function verifyLive({ url, expectCommit, expectVersion, timeoutSeconds = 90, intervalMs = 5000, log = console.log }) {
  const base = url.replace(/\/+$/, '');
  const deadline = Date.now() + timeoutSeconds * 1000;
  let problems = [];
  let health = null;
  let version = null;
  for (let attempt = 1; ; attempt++) {
    const why = {};
    [health, version] = await Promise.all([readJson(`${base}/health`, why), expectCommit ? readJson(`${base}/version.json`, why) : null]);
    problems = compare({ health, version, expectCommit, expectVersion, why });
    if (problems.length === 0) return { ok: true, health, version, attempts: attempt, problems };
    if (Date.now() + intervalMs > deadline) return { ok: false, health, version, attempts: attempt, problems };
    log(`  lần ${attempt}: ${problems.join('; ')}. Thử lại sau ${Math.round(intervalMs / 1000)} giây.`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url || process.env.APP_URL || 'https://hoiminh.com';
  const expectCommit = args.commit && args.commit !== 'true' ? args.commit : '';
  const expectVersion = args.version && args.version !== 'true' ? args.version : '';
  console.log(`Kiểm tra ${url}${expectVersion ? `, mong đợi bản ${expectVersion}` : ''}${expectCommit ? `, commit ${expectCommit.slice(0, 7)}` : ''}`);
  const r = await verifyLive({ url, expectCommit, expectVersion, timeoutSeconds: Number(args.timeout) || 90 });
  if (r.ok) {
    console.log(`✔ Trang live đã chạy bản ${r.health?.version ?? '?'}${r.version?.shortCommit ? ` (${r.version.shortCommit})` : ''}, database nối được, phản hồi ${r.health?.latencyMs ?? '?'}ms.`);
  } else {
    const msg = `Trang live chưa khớp bản vừa deploy: ${r.problems.join('; ')}.`;
    console.error(process.env.GITHUB_ACTIONS ? `::error::${msg}` : `✘ ${msg}`);
    console.error('Mở /he-thong/phien-ban để xem bản đang chạy và bấm "Quay lui" nếu cần.');
    process.exit(1);
  }
}
