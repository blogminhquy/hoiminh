// Test luật làm song song. Chạy: pnpm test:scripts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bumpBetween, decisionNumberingError, journalErrors, nextVersion, parseFragment, pullRequestErrors, stamp } from './lib/parallel-core.mjs';

const CHANGELOG = '# CHANGELOG\n\n## 1.36.2 - 2026-11-21\n\nBản cũ.\n## 1.36.1 - 2026-11-21\n\n- Cũ hơn.\n';
const DECISIONS = '# DECISIONS\n\n## Nhóm\n\n1. **Một** (1.0.0). A.\n\n2. **Hai** (1.36.2). B.\n';
const PKG = '{\n  "name": "hoiminh",\n  "version": "1.36.2",\n  "dependencies": { "x": "1.0.0" }\n}\n';
const TS = "export const APP_VERSION = '1.36.2';\n";
const fragment = (bump, body, decisions = '') => `---\nbump: ${bump}\n---\n\n${body}\n${decisions}`;
const FRAG_A = { name: 'a.md', text: fragment('minor', '### Thêm\n\n- **Menu ba chấm.** Xem mục {muc}.', '\n## Quyết định\n\n**Menu** ({version}, chủ dự án yêu cầu). Lý do.\n') };
const FRAG_B = { name: 'b.md', text: fragment('patch', '### Sửa\n\n- Sửa lỗi nhỏ.') };

/** Một PR đúng luật, chưa đóng số: chỉ thêm phiếu và sửa mã. */
function pr(over = {}) {
  return {
    baseVersion: '1.36.2',
    headVersion: '1.36.2',
    headVersionTs: '1.36.2',
    baseChangelog: CHANGELOG,
    headChangelog: CHANGELOG,
    baseDecisions: DECISIONS,
    headDecisions: DECISIONS,
    fragments: [FRAG_A],
    changedFiles: ['apps/web/src/pages/community/Courses.tsx', 'changes/a.md'],
    journal: null,
    ...over,
  };
}

/** Đóng số một PR rồi trả về trạng thái sau khi đóng, như phiên merge làm. */
function stamped(fragments, over = {}) {
  const out = stamp({ version: '1.36.2', date: '2026-11-22', fragments: fragments.map((f) => parseFragment(f.name, f.text)), packageJson: PKG, versionTs: TS, changelog: CHANGELOG, decisions: DECISIONS });
  return { out, input: pr({ headVersion: out.version, headVersionTs: out.version, headChangelog: out.changelog, headDecisions: out.decisions, fragments: [], ...over }) };
}

describe('số phiên bản', () => {
  it('tăng đúng bậc', () => {
    assert.equal(nextVersion('1.36.2', 'patch'), '1.36.3');
    assert.equal(nextVersion('1.36.2', 'minor'), '1.37.0');
    assert.equal(nextVersion('1.36.2', 'major'), '2.0.0');
  });
  it('nhận ra bước kế tiếp và từ chối bước nhảy cóc', () => {
    assert.equal(bumpBetween('1.36.2', '1.37.0'), 'minor');
    assert.equal(bumpBetween('1.36.2', '1.36.2'), null);
    assert.equal(bumpBetween('1.36.2', '1.38.0'), null);
    assert.equal(bumpBetween('1.36.2', '1.36.1'), null);
  });
});

describe('phiếu thay đổi', () => {
  it('đọc được mức tăng, nội dung và quyết định', () => {
    const f = parseFragment('a.md', FRAG_A.text);
    assert.equal(f.bump, 'minor');
    assert.match(f.body, /^### Thêm/);
    assert.deepEqual(f.decisions, ['**Menu** ({version}, chủ dự án yêu cầu). Lý do.']);
  });
  it('tách nhiều quyết định theo tiêu đề in đậm, giữ các dòng nối tiếp', () => {
    const f = parseFragment('x.md', fragment('patch', 'Nội dung.', '\n## Quyết định\n\n**Một.** A\n  - ý phụ\n\n**Hai.** B\n'));
    assert.deepEqual(f.decisions, ['**Một.** A\n  - ý phụ', '**Hai.** B']);
  });
  it('báo lỗi rõ khi phiếu sai dạng', () => {
    assert.throws(() => parseFragment('x.md', 'Không có phần đầu'), /thiếu phần đầu/);
    assert.throws(() => parseFragment('x.md', fragment('lon', 'Nội dung.')), /"bump" phải là/);
    assert.throws(() => parseFragment('x.md', fragment('patch', '')), /chưa có nội dung/);
    assert.throws(() => parseFragment('x.md', fragment('patch', '## 1.40.0 - 2026-11-21\n\n- Tự đặt số.')), /tiêu đề cấp 1 hoặc 2/);
    assert.throws(() => parseFragment('x.md', fragment('patch', 'Nội dung.', '\n## Quyết định\n\nKhông in đậm.\n')), /in đậm/);
    assert.throws(() => parseFragment('x.md', '---\nbump: patch\nversion: 1.40.0\n---\nNội dung.'), /chỉ nhận "bump"/);
  });
});

describe('đóng số phiên bản', () => {
  it('ghi số mới vào cả bốn tệp, giữ nguyên mọi thứ khác', () => {
    const { out } = stamped([FRAG_A]);
    assert.equal(out.version, '1.37.0');
    assert.equal(out.packageJson, PKG.replace('"version": "1.36.2"', '"version": "1.37.0"'));
    assert.equal(out.versionTs, "export const APP_VERSION = '1.37.0';\n");
    assert.ok(out.changelog.startsWith('# CHANGELOG\n\n## 1.37.0 - 2026-11-22\n\n### Thêm\n\n- **Menu ba chấm.** Xem mục 3.\n\n## 1.36.2 - 2026-11-21\n'));
    assert.ok(out.changelog.endsWith(CHANGELOG.slice(CHANGELOG.indexOf('## 1.36.2'))));
    assert.ok(out.decisions.startsWith(DECISIONS.trimEnd()));
    assert.ok(out.decisions.endsWith('\n\n3. **Menu** (1.37.0, chủ dự án yêu cầu). Lý do.\n'));
  });
  it('nhiều phiếu thì lấy mức tăng lớn nhất và gom theo tên phiếu', () => {
    const { out } = stamped([FRAG_B, FRAG_A]);
    assert.equal(out.version, '1.37.0');
    assert.ok(out.changelog.indexOf('Menu ba chấm') < out.changelog.indexOf('Sửa lỗi nhỏ'));
  });
  it('chỉ có phiếu patch thì tăng số cuối, không đụng DECISIONS', () => {
    const { out } = stamped([FRAG_B]);
    assert.equal(out.version, '1.36.3');
    assert.equal(out.decisions, DECISIONS);
  });
  it('từ chối {muc} khi phiếu không có quyết định', () => {
    const bad = parseFragment('x.md', fragment('patch', 'Xem mục {muc}.'));
    assert.throws(() => stamp({ version: '1.36.2', date: '2026-11-22', fragments: [bad], packageJson: PKG, versionTs: TS, changelog: CHANGELOG, decisions: DECISIONS }), /\{muc\}/);
  });
});

describe('kiểm PR chưa đóng số', () => {
  it('PR chỉ thêm phiếu và sửa mã thì đạt', () => {
    assert.deepEqual(pullRequestErrors(pr()), []);
  });
  it('PR chỉ sửa tài liệu, CI, script thì không cần phiếu', () => {
    assert.deepEqual(pullRequestErrors(pr({ fragments: [], changedFiles: ['CLAUDE.md', '.github/workflows/ci.yml', 'scripts/x.mjs'] })), []);
  });
  it('sửa mã mà không có phiếu thì báo', () => {
    const errors = pullRequestErrors(pr({ fragments: [] }));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /chưa có phiếu thay đổi/);
  });
  it('tự viết CHANGELOG dưới số phiên bản main đã dùng thì báo (trường hợp hai PR cùng nhận 1.36.2)', () => {
    const hand = CHANGELOG.replace('Bản cũ.', 'Bản cũ.\n\n### Thêm\n\n- Chen vào bản đã phát hành.');
    const errors = pullRequestErrors(pr({ headChangelog: hand }));
    assert.equal(errors.length, 1);
    assert.match(errors[0], /CHANGELOG\.md khác main/);
  });
  it('tự thêm mục vào DECISIONS thì báo', () => {
    const errors = pullRequestErrors(pr({ headDecisions: `${DECISIONS}\n3. **Ba** (1.37.0). C.\n` }));
    assert.match(errors.join('\n'), /Quyết định mới viết trong phiếu/);
  });
  it('phiếu sai dạng thì báo tên phiếu', () => {
    const errors = pullRequestErrors(pr({ fragments: [{ name: 'hong.md', text: 'không có phần đầu' }] }));
    assert.match(errors[0], /changes\/hong\.md/);
  });
});

describe('kiểm PR đã đóng số', () => {
  it('đóng số bằng lệnh thì đạt', () => {
    assert.deepEqual(pullRequestErrors(stamped([FRAG_A]).input), []);
    assert.deepEqual(pullRequestErrors(stamped([FRAG_B]).input), []);
  });
  it('PR khác lấy đúng số đó trước thì báo (hai PR cùng đóng 1.37.0)', () => {
    const { input } = stamped([FRAG_A], { baseVersion: '1.37.0' });
    assert.match(pullRequestErrors(input).join('\n'), /một PR khác lấy số đó trước/);
  });
  it('main đã đi xa hơn số nhánh đóng thì báo', () => {
    const { input } = stamped([FRAG_A], { baseVersion: '1.38.0' });
    assert.match(pullRequestErrors(input).join('\n'), /không phải bước kế tiếp/);
  });
  it('nhảy cóc số phiên bản thì báo', () => {
    const { input } = stamped([FRAG_A], { headVersion: '1.38.0', headVersionTs: '1.38.0' });
    assert.match(pullRequestErrors(input).join('\n'), /không phải bước kế tiếp/);
  });
  it('gỡ xung đột làm mất một mục cũ của CHANGELOG thì báo', () => {
    const { input, out } = stamped([FRAG_A]);
    const lost = out.changelog.replace('## 1.36.1 - 2026-11-21\n\n- Cũ hơn.\n', '');
    assert.match(pullRequestErrors({ ...input, headChangelog: lost }).join('\n'), /các mục cũ giữ nguyên/);
  });
  it('package.json và version.ts lệch nhau thì báo', () => {
    const { input } = stamped([FRAG_A], { headVersionTs: '1.36.2' });
    assert.match(pullRequestErrors(input).join('\n'), /Hai nơi phải cùng một số/);
  });
  it('đóng số rồi mà còn phiếu thì báo', () => {
    const { input } = stamped([FRAG_A], { fragments: [FRAG_B] });
    assert.match(pullRequestErrors(input).join('\n'), /còn phiếu chưa gộp/);
  });
});

describe('đánh số DECISIONS', () => {
  it('hai nhánh cùng thêm một số thì báo', () => {
    assert.equal(decisionNumberingError(DECISIONS), null);
    assert.match(decisionNumberingError(`${DECISIONS}\n3. **Ba**\n\n3. **Ba nữa**\n`), /mục thứ 4 mang số 3/);
  });
});

describe('journal migration', () => {
  const entry = (idx, tag, when) => ({ idx, version: '7', when, tag, breakpoints: true });
  const base = [entry(0, '0000_init', 100), entry(1, '0001_a', 200)];
  const ok = { base, head: [...base, entry(2, '0002_b', 300)], sqlTags: ['0000_init', '0001_a', '0002_b'], changedBaseSql: [] };

  it('migration mới xếp sau, mốc thời gian lớn hơn thì đạt', () => {
    assert.deepEqual(journalErrors(ok), []);
    assert.deepEqual(journalErrors({ base, head: base, sqlTags: ['0000_init', '0001_a'], changedBaseSql: [] }), []);
  });
  it('migration tạo trước mà merge sau (mốc thời gian cũ hơn) thì báo: database thật sẽ bỏ qua nó', () => {
    const errors = journalErrors({ ...ok, head: [...base, entry(2, '0002_b', 150)] });
    assert.match(errors.join('\n'), /database thật sẽ bỏ qua/);
  });
  it('hai nhánh cùng lấy một số migration thì báo', () => {
    const head = [base[0], entry(1, '0001_b', 150), entry(2, '0001_a', 200)];
    const errors = journalErrors({ base, head, sqlTags: ['0000_init', '0001_a', '0001_b'], changedBaseSql: [] });
    assert.match(errors.join('\n'), /đã có trên main bị đổi chỗ/);
  });
  it('tệp .sql không có trong journal, hoặc journal thiếu tệp, thì báo', () => {
    assert.match(journalErrors({ ...ok, sqlTags: [...ok.sqlTags, '0002_c'] }).join('\n'), /sẽ không bao giờ được áp/);
    assert.match(journalErrors({ ...ok, sqlTags: ['0000_init', '0001_a'] }).join('\n'), /thiếu tệp/);
  });
  it('sửa migration đã vào main thì báo', () => {
    assert.match(journalErrors({ ...ok, changedBaseSql: ['0001_a'] }).join('\n'), /viết migration mới/);
  });
});
