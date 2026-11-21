// Kiểm một nhánh có giữ đúng luật làm song song không (CLAUDE.md, mục "Làm song song nhiều phiên").
// CI chạy ở mọi PR:   node scripts/check-parallel.mjs --base HEAD^1
//   (trên CI, HEAD là commit merge thử của GitHub: PR đã gộp main mới nhất, HEAD^1 là đầu main.)
// Chạy tại máy trước khi push:   pnpm check:parallel
//   (mặc định so với điểm nhánh tách ra khỏi origin/main, tính cả thay đổi chưa commit.)
import { pullRequestErrors } from './lib/parallel-core.mjs';
import { FILES, appVersion, git, packageVersion, read, readAt, readFragments, readJournal, tryGit } from './lib/repo.mjs';

const args = process.argv.slice(2);
const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
const base = (baseArg ? tryGit('rev-parse', '--verify', `${baseArg}^{commit}`) : tryGit('merge-base', 'origin/main', 'HEAD'))?.trim();
if (!base) {
  console.error(`Không xác định được bản gốc để so (${baseArg ?? 'origin/main'}). Chạy \`git fetch origin main\` rồi thử lại.`);
  process.exit(2);
}

const tracked = git('diff', '--name-only', base).split('\n');
const untracked = git('ls-files', '--others', '--exclude-standard').split('\n');
const changedFiles = [...tracked, ...untracked].filter(Boolean);

const errors = pullRequestErrors({
  baseVersion: packageVersion(readAt(base, FILES.packageJson)),
  headVersion: packageVersion(read(FILES.packageJson)),
  headVersionTs: appVersion(read(FILES.versionTs)),
  baseChangelog: readAt(base, FILES.changelog),
  headChangelog: read(FILES.changelog),
  baseDecisions: readAt(base, FILES.decisions),
  headDecisions: read(FILES.decisions),
  fragments: readFragments(),
  changedFiles,
  journal: readJournal(base),
});

if (errors.length === 0) {
  console.info('Luật làm song song: đạt.');
  process.exit(0);
}
console.error(`Luật làm song song: ${errors.length} chỗ chưa đạt.\n`);
for (const [i, error] of errors.entries()) console.error(`${i + 1}. ${error}\n`);
console.error('Luật đầy đủ ở CLAUDE.md, mục "Làm song song nhiều phiên".');
process.exit(1);
