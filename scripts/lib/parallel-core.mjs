// Luật làm song song: phần tính toán thuần, không đụng git và không đụng đĩa, để test được từng luật.
// Hai lệnh dùng chung tệp này:
//   scripts/stamp-version.mjs   đóng số phiên bản từ các phiếu trong changes/ (phiên merge chạy, ngay trước khi merge).
//   scripts/check-parallel.mjs  kiểm một PR có giữ đúng luật không (CI chạy ở mọi PR).
// Luật viết bằng lời ở CLAUDE.md, mục "Làm song song nhiều phiên".

export const BUMPS = ['patch', 'minor', 'major'];
const DECISIONS_MARK = /^## Quyết định\s*$/m;

/** '1.36.2' thành [1, 36, 2]. Không đúng dạng ba số thì ném lỗi. */
export function parseVersion(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version).trim());
  if (!m) throw new Error(`Số phiên bản "${version}" không đúng dạng ba số, ví dụ 1.36.2.`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function nextVersion(version, bump) {
  const [major, minor, patch] = parseVersion(version);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Mức tăng "${bump}" không hợp lệ. Chỉ nhận: ${BUMPS.join(', ')}.`);
}

/** head là bước kế tiếp nào của base: 'patch', 'minor', 'major', hoặc null nếu không phải bước kế tiếp. */
export function bumpBetween(base, head) {
  return BUMPS.find((bump) => nextVersion(base, bump) === head) ?? null;
}

/** Mức tăng lớn nhất trong các phiếu: có một phiếu minor thì cả bản là minor. */
export function highestBump(bumps) {
  return BUMPS[Math.max(...bumps.map((bump) => BUMPS.indexOf(bump)))];
}

/**
 * Đọc một phiếu thay đổi (changes/<tên>.md).
 * Trả về { name, bump, body, decisions }. Sai dạng thì ném lỗi có tên phiếu và cách sửa.
 */
export function parseFragment(name, raw) {
  const fail = (message) => {
    throw new Error(`Phiếu changes/${name}: ${message}`);
  };
  const text = raw.replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) fail('thiếu phần đầu. Phiếu phải mở bằng ba dòng: "---", "bump: patch" (hoặc minor, major), "---".');
  const meta = {};
  for (const line of m[1].split('\n')) {
    if (line.trim() === '') continue;
    const kv = /^([a-z]+):\s*(.*)$/.exec(line.trim());
    if (!kv) fail(`dòng "${line}" ở phần đầu không đúng dạng "tên: giá trị".`);
    meta[kv[1]] = kv[2].trim();
  }
  const extra = Object.keys(meta).filter((key) => key !== 'bump');
  if (extra.length > 0) fail(`phần đầu chỉ nhận "bump", gặp thêm: ${extra.join(', ')}.`);
  if (!BUMPS.includes(meta.bump)) fail(`"bump" phải là một trong: ${BUMPS.join(', ')}.`);

  const [bodyPart, ...rest] = m[2].split(DECISIONS_MARK);
  if (rest.length > 1) fail('chỉ được có một dòng "## Quyết định".');
  const body = bodyPart.trim();
  if (body === '') fail('chưa có nội dung. Viết phần sẽ vào CHANGELOG ngay dưới phần đầu.');
  if (/^#{1,2}\s/m.test(body)) {
    fail('nội dung không được có tiêu đề cấp 1 hoặc 2 ("#", "##"). Dùng "### Thêm", "### Sửa", "### Thay đổi".');
  }

  const decisions = [];
  for (const line of (rest[0] ?? '').trim().split('\n')) {
    if (line.startsWith('**')) decisions.push(line);
    else if (decisions.length > 0) decisions[decisions.length - 1] += `\n${line}`;
    else if (line.trim() !== '') fail('mỗi quyết định phải mở bằng tiêu đề in đậm ("**Tiêu đề** ...").');
  }
  return { name, bump: meta.bump, body, decisions: decisions.map((d) => d.trim()) };
}

/** Số thứ tự của các mục đã đánh số trong DECISIONS.md, theo thứ tự xuất hiện. */
export function decisionNumbers(markdown) {
  return [...markdown.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
}

/** Các mục phải đánh số liền nhau 1, 2, 3... Trả về câu báo lỗi, hoặc null khi đúng. */
export function decisionNumberingError(markdown) {
  const numbers = decisionNumbers(markdown);
  const wrong = numbers.findIndex((n, i) => n !== i + 1);
  if (wrong === -1) return null;
  return `DECISIONS.md đánh số không liền nhau: mục thứ ${wrong + 1} mang số ${numbers[wrong]}. Hai nhánh cùng thêm một số thường gây ra lỗi này.`;
}

function fill(text, version, firstDecision) {
  if (text.includes('{muc}') && firstDecision === null) {
    throw new Error('Phiếu dùng {muc} nhưng không có quyết định nào dưới dòng "## Quyết định".');
  }
  return text.replaceAll('{version}', version).replaceAll('{muc}', String(firstDecision));
}

/**
 * Đóng số phiên bản: từ bản hiện tại và các phiếu, tính ra nội dung mới của bốn tệp chung.
 * Không ghi gì ra đĩa. Phiếu xếp theo tên để kết quả không phụ thuộc thứ tự đọc thư mục.
 */
export function stamp({ version, date, fragments, packageJson, versionTs, changelog, decisions }) {
  if (fragments.length === 0) throw new Error('Không có phiếu nào trong changes/ để đóng số.');
  const sorted = [...fragments].sort((a, b) => a.name.localeCompare(b.name));
  const next = nextVersion(version, highestBump(sorted.map((f) => f.bump)));

  const newDecisions = sorted.flatMap((f) => f.decisions);
  const numbers = decisionNumbers(decisions);
  const firstDecision = newDecisions.length > 0 ? numbers.length + 1 : null;
  let decisionsOut = decisions;
  if (firstDecision !== null) {
    const lines = newDecisions.map((d, i) => `${firstDecision + i}. ${fill(d, next, firstDecision)}`);
    decisionsOut = `${decisions.trimEnd()}\n\n${lines.join('\n\n')}\n`;
  }

  const entry = `## ${next} - ${date}\n\n${sorted.map((f) => fill(f.body, next, firstDecision)).join('\n\n')}\n\n`;
  const at = changelog.search(/^## /m);
  const changelogOut = at === -1 ? `${changelog.trimEnd()}\n\n${entry}` : changelog.slice(0, at) + entry + changelog.slice(at);

  const pkgOut = packageJson.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`);
  const tsOut = versionTs.replace(/(APP_VERSION\s*=\s*')[^']+(')/, `$1${next}$2`);
  if (pkgOut === packageJson) throw new Error('Không tìm thấy dòng "version" trong package.json.');
  if (tsOut === versionTs) throw new Error('Không tìm thấy APP_VERSION trong packages/config/src/version.ts.');

  return { version: next, entry, packageJson: pkgOut, versionTs: tsOut, changelog: changelogOut, decisions: decisionsOut };
}

/** Số phiên bản của mục đầu tiên trong CHANGELOG, và phần còn lại sau mục đó. */
function splitChangelog(changelog) {
  const first = changelog.search(/^## /m);
  if (first === -1) return { header: changelog, version: null, rest: '' };
  const afterFirst = changelog.slice(first + 3);
  const second = afterFirst.search(/^## /m);
  return {
    header: changelog.slice(0, first),
    version: /^(\S+)/.exec(afterFirst)?.[1] ?? null,
    rest: second === -1 ? '' : afterFirst.slice(second),
  };
}

/**
 * Kiểm journal migration của drizzle. base là journal trên main, head là journal của PR sau khi gộp main.
 * drizzle chỉ chạy migration có mốc `when` lớn hơn migration đã áp cuối cùng, nên một migration tạo trước
 * mà merge sau sẽ bị bỏ qua âm thầm trên database thật nếu mốc `when` không được làm mới.
 */
export function journalErrors({ base, head, sqlTags, changedBaseSql }) {
  const errors = [];
  const redo = 'Cách sửa: xóa migration của nhánh (tệp .sql, snapshot, dòng trong _journal.json), kéo main về, rồi chạy lại `pnpm db:generate`.';
  head.forEach((entry, i) => {
    if (entry.idx !== i) errors.push(`Migration "${entry.tag}" mang idx ${entry.idx}, đúng ra là ${i}. ${redo}`);
    if (!entry.tag.startsWith(`${String(i).padStart(4, '0')}_`)) {
      errors.push(`Migration "${entry.tag}" đứng thứ ${i} nhưng tên không mở bằng ${String(i).padStart(4, '0')}_. ${redo}`);
    }
    if (i > 0 && entry.when <= head[i - 1].when) {
      errors.push(`Migration "${entry.tag}" có mốc thời gian không lớn hơn "${head[i - 1].tag}" đứng trước nó, nên database thật sẽ bỏ qua nó. ${redo}`);
    }
  });
  base.forEach((entry, i) => {
    if (!head[i] || head[i].tag !== entry.tag || head[i].when !== entry.when) {
      errors.push(`Migration "${entry.tag}" đã có trên main bị đổi chỗ, đổi mốc thời gian hoặc mất. Migration đã vào main thì giữ nguyên, migration của nhánh xếp sau. ${redo}`);
    }
  });
  const tags = head.map((entry) => entry.tag);
  for (const tag of tags) {
    if (!sqlTags.includes(tag)) errors.push(`Journal có "${tag}" nhưng thiếu tệp packages/db/migrations/${tag}.sql.`);
  }
  for (const tag of sqlTags) {
    if (!tags.includes(tag)) errors.push(`Tệp packages/db/migrations/${tag}.sql không có trong _journal.json nên sẽ không bao giờ được áp. ${redo}`);
  }
  for (const tag of changedBaseSql) {
    errors.push(`Migration "${tag}" đã có trên main bị sửa hoặc xóa. Database thật đã áp bản cũ: muốn đổi thì viết migration mới.`);
  }
  return errors;
}

/**
 * Kiểm một PR. base là main, head là PR sau khi gộp main (trên CI: commit merge thử của GitHub).
 * Trả về danh sách câu báo lỗi, rỗng là đạt.
 */
export function pullRequestErrors(input) {
  const { baseVersion, headVersion, headVersionTs, baseChangelog, headChangelog, baseDecisions, headDecisions, fragments, changedFiles, journal } = input;
  const errors = [];

  const parsed = [];
  for (const fragment of fragments) {
    try {
      parsed.push(parseFragment(fragment.name, fragment.text));
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (headVersionTs !== headVersion) {
    errors.push(`package.json ghi bản ${headVersion} nhưng packages/config/src/version.ts ghi ${headVersionTs}. Hai nơi phải cùng một số.`);
  }

  const baseCount = decisionNumbers(baseDecisions).length;
  const headCount = decisionNumbers(headDecisions).length;
  const numbering = decisionNumberingError(headDecisions);
  if (numbering) errors.push(numbering);

  if (headVersion === baseVersion) {
    // PR chưa đóng số: không được tự đụng vào các tệp chung, mọi thứ nằm trong phiếu.
    if (headChangelog !== baseChangelog) {
      errors.push(
        `CHANGELOG.md khác main trong khi số phiên bản vẫn là ${baseVersion} của main. Có hai khả năng. ` +
          '(1) Nhánh tự viết CHANGELOG: chuyển phần mô tả sang một phiếu changes/<tên-nhánh>.md (xem changes/README.md), rồi trả CHANGELOG.md về như main ' +
          '(`git checkout origin/main -- CHANGELOG.md`). ' +
          `(2) Nhánh đã đóng số ${baseVersion} nhưng một PR khác lấy số đó trước: hoàn tác commit đóng số (\`git revert <commit>\`), kéo main về, rồi đóng số lại. ` +
          'Số phiên bản chỉ do phiên merge đóng, ngay trước khi merge.',
      );
    }
    if (headCount !== baseCount) {
      errors.push(
        'DECISIONS.md có thêm hoặc bớt mục đánh số. Quyết định mới viết trong phiếu, dưới dòng "## Quyết định", để phiên merge đánh số. ' +
          'Trả DECISIONS.md về như main (`git checkout origin/main -- DECISIONS.md`).',
      );
    }
    const code = changedFiles.filter((file) => file.startsWith('apps/') || file.startsWith('packages/'));
    if (code.length > 0 && fragments.length === 0) {
      errors.push(
        `PR sửa mã (${code.length} tệp trong apps/ và packages/, ví dụ ${code[0]}) mà chưa có phiếu thay đổi. ` +
          'Thêm changes/<tên-nhánh>.md theo mẫu trong changes/README.md.',
      );
    }
  } else {
    // PR đã đóng số: số phải là bước kế tiếp của main, và CHANGELOG chỉ được thêm đúng một mục ở đầu.
    const undo = 'Cách sửa: hoàn tác commit đóng số (`git revert <commit>`), kéo main về, rồi chạy lại `pnpm version:stamp`.';
    if (!bumpBetween(baseVersion, headVersion)) {
      errors.push(`Bản ${headVersion} không phải bước kế tiếp của bản ${baseVersion} đang ở main (main đã đi tiếp sau khi nhánh đóng số, hoặc số bị đặt tay). ${undo}`);
    }
    if (fragments.length > 0) {
      errors.push(`Đã đóng số ${headVersion} nhưng còn phiếu chưa gộp trong changes/: ${fragments.map((f) => f.name).join(', ')}. ${undo}`);
    }
    const base = splitChangelog(baseChangelog);
    const head = splitChangelog(headChangelog);
    if (head.version !== headVersion) {
      errors.push(`Mục đầu CHANGELOG.md là ${head.version ?? '(trống)'}, đúng ra phải là ${headVersion}.`);
    }
    if (head.header !== base.header || head.rest !== baseChangelog.slice(base.header.length)) {
      errors.push(`CHANGELOG.md chỉ được thêm một mục mới ở đầu, các mục cũ giữ nguyên từng chữ. Bản trên nhánh đang làm mất hoặc đổi mục cũ (thường do gỡ xung đột bằng tay). ${undo}`);
    }
    if (headCount < baseCount) errors.push(`DECISIONS.md mất mục so với main. ${undo}`);
  }

  if (parsed.length > 0 && headVersion === baseVersion) {
    try {
      stamp({ version: baseVersion, date: '2000-01-01', fragments: parsed, packageJson: '"version": "0.0.0"', versionTs: "APP_VERSION = '0.0.0'", changelog: baseChangelog, decisions: baseDecisions });
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (journal) errors.push(...journalErrors(journal));
  return errors;
}
