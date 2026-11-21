// Đọc repo cho hai lệnh stamp-version và check-parallel: git và các tệp chung.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const FILES = {
  packageJson: 'package.json',
  versionTs: 'packages/config/src/version.ts',
  changelog: 'CHANGELOG.md',
  decisions: 'DECISIONS.md',
};
export const CHANGES_DIR = 'changes';
export const MIGRATIONS_DIR = 'packages/db/migrations';
const JOURNAL = `${MIGRATIONS_DIR}/meta/_journal.json`;

/** Chạy git ở gốc repo, trả về stdout. Lỗi thì ném. */
export function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
}

/** Như git() nhưng trả null khi lệnh thất bại (tệp không có ở ref, ref không tồn tại...). */
export function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}

export function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

/** Nội dung một tệp tại một ref, chuỗi rỗng nếu ref đó chưa có tệp. */
export function readAt(ref, path) {
  return tryGit('show', `${ref}:${path}`) ?? '';
}

export function packageVersion(packageJson) {
  return JSON.parse(packageJson).version;
}

export function appVersion(versionTs) {
  return /APP_VERSION\s*=\s*'([^']+)'/.exec(versionTs)?.[1] ?? '';
}

/** Các phiếu đang có trong changes/ (không tính README.md). */
export function readFragments() {
  const dir = join(root, CHANGES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
}

function journalEntries(text) {
  return text === '' ? [] : JSON.parse(text).entries;
}

/** Dữ liệu cho journalErrors: journal ở base và hiện tại, các tệp .sql đang có, migration cũ bị đụng tới. */
export function readJournal(baseRef) {
  const base = journalEntries(readAt(baseRef, JOURNAL));
  const head = journalEntries(existsSync(join(root, JOURNAL)) ? read(JOURNAL) : '');
  const dir = join(root, MIGRATIONS_DIR);
  const sqlTags = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.sql')).map((name) => name.slice(0, -4)) : [];
  const touched = (tryGit('diff', '--name-only', baseRef, '--', MIGRATIONS_DIR) ?? '').split('\n');
  const changedBaseSql = base.map((entry) => entry.tag).filter((tag) => touched.includes(`${MIGRATIONS_DIR}/${tag}.sql`));
  return { base, head, sqlTags, changedBaseSql };
}
