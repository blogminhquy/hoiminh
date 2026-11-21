// Đóng số phiên bản cho một nhánh, ngay trước khi merge. Chỉ phiên merge chạy lệnh này.
// Gom các phiếu trong changes/ thành: số phiên bản mới (package.json, version.ts), một mục ở đầu CHANGELOG.md,
// các mục đánh số tiếp ở cuối DECISIONS.md. Xong thì xóa phiếu.
//   pnpm version:stamp             đóng số rồi commit riêng một commit "Đóng số phiên bản X.Y.Z"
//   pnpm version:stamp --dry-run   chỉ in ra số sẽ đóng và mục CHANGELOG, không ghi gì
//   --date 2026-11-21              đặt ngày phát hành (mặc định: hôm nay theo giờ Việt Nam)
//   --no-commit                    ghi tệp nhưng không commit
//   --no-fetch                     không gọi `git fetch` (khi không có mạng)
// Nhánh phải chứa main mới nhất thì mới đóng số được: số phiên bản tính từ main, không tính từ nhánh.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFragment, stamp } from './lib/parallel-core.mjs';
import { CHANGES_DIR, FILES, git, packageVersion, read, readAt, readFragments, root, tryGit } from './lib/repo.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const date = flag('--date')
  ? args[args.indexOf('--date') + 1]
  : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

function stop(message) {
  console.error(message);
  process.exit(1);
}

try {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) stop('--date phải có dạng 2026-11-21.');
  if (!flag('--no-fetch')) git('fetch', '--quiet', 'origin', 'main');
  if (tryGit('merge-base', '--is-ancestor', 'origin/main', 'HEAD') === null) {
    stop('Nhánh chưa chứa main mới nhất. Kéo về trước (`git merge origin/main`), rồi mới đóng số.');
  }

  const fragments = readFragments();
  if (fragments.length === 0) {
    console.info('Không có phiếu nào trong changes/: nhánh này không đổi số phiên bản, không cần đóng số.');
    process.exit(0);
  }

  const mainVersion = packageVersion(readAt('origin/main', FILES.packageJson));
  const current = { packageJson: read(FILES.packageJson), versionTs: read(FILES.versionTs), changelog: read(FILES.changelog), decisions: read(FILES.decisions) };
  if (packageVersion(current.packageJson) !== mainVersion) {
    stop(`Nhánh đang ghi bản ${packageVersion(current.packageJson)} trong khi main ở bản ${mainVersion}: nhánh đã đóng số rồi, hoặc tự đặt số. Hoàn tác commit đóng số cũ (\`git revert <commit>\`) rồi chạy lại.`);
  }
  if (!flag('--dry-run') && !flag('--no-commit') && git('status', '--porcelain', '--untracked-files=no').trim() !== '') {
    stop('Còn thay đổi chưa commit. Commit hoặc cất đi trước, để commit đóng số chỉ chứa đúng phần đóng số.');
  }

  const out = stamp({ version: mainVersion, date, fragments: fragments.map((f) => parseFragment(f.name, f.text)), ...current });

  console.info(`Bản ${mainVersion} lên ${out.version}, gom ${fragments.length} phiếu: ${fragments.map((f) => f.name).join(', ')}\n`);
  console.info(out.entry.trimEnd());
  if (flag('--dry-run')) {
    console.info('\n(--dry-run: chưa ghi gì.)');
    process.exit(0);
  }

  writeFileSync(join(root, FILES.packageJson), out.packageJson);
  writeFileSync(join(root, FILES.versionTs), out.versionTs);
  writeFileSync(join(root, FILES.changelog), out.changelog);
  writeFileSync(join(root, FILES.decisions), out.decisions);
  for (const fragment of fragments) rmSync(join(root, CHANGES_DIR, fragment.name));

  if (flag('--no-commit')) {
    console.info('\nĐã ghi tệp, chưa commit (--no-commit).');
  } else {
    git('add', '--', ...Object.values(FILES), CHANGES_DIR);
    git('commit', '--quiet', '-m', `Đóng số phiên bản ${out.version}`);
    console.info(`\nĐã commit "Đóng số phiên bản ${out.version}". Việc tiếp theo: push, thêm "(${out.version})" vào cuối tên PR, chờ CI xanh rồi merge.`);
  }
} catch (error) {
  stop(error.message);
}
