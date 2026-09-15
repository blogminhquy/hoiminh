// Plugin Vite: gom thông tin phiên bản lúc build (package.json + git + CHANGELOG),
// nhúng vào bundle qua __HM_BUILD__ và ghi ra `dist/version.json` để web đang mở biết có bản mới.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

export interface ReleaseSection {
  title: string;
  items: string[];
}
export interface ReleaseNote {
  version: string;
  date: string;
  summary: string;
  sections: ReleaseSection[];
}
/** Thông tin build nhúng thẳng vào bundle (hằng số __HM_BUILD__). */
export interface BuildInfo {
  version: string;
  buildId: string;
  commit: string;
  shortCommit: string;
  branch: string;
  commitMessage: string;
  commitTime: string | null;
  buildTime: string;
  repoUrl: string | null;
  releases: ReleaseNote[];
}
/** Phần tĩnh phục vụ ở `/version.json` — chỉ đủ để so sánh, tải nhanh. */
export type DeployedVersion = Pick<BuildInfo, 'buildId' | 'version' | 'shortCommit' | 'branch' | 'buildTime'>;

function git(args: string[]): string | null {
  try {
    const out = execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const v = out.trim();
    return v === '' ? null : v;
  } catch {
    return null;
  }
}

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Chuẩn hóa remote git về URL https xem được trên trình duyệt. */
function normalizeRepoUrl(raw: string | null): string | null {
  if (!raw) return null;
  const m = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(raw);
  if (m) return `https://${m[1]}/${m[2]}`;
  return raw.replace(/\.git$/, '');
}

/** Tách CHANGELOG.md thành danh sách phiên bản: `## <số> — <ngày>`, `### <mục>`, `- <ý>`. */
export function parseChangelog(markdown: string): ReleaseNote[] {
  const releases: ReleaseNote[] = [];
  let current: ReleaseNote | null = null;
  let section: ReleaseSection | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const release = /^##\s+(?!#)(.+)$/.exec(line);
    if (release) {
      const [version = '', date = ''] = release[1]!.split(/\s+[—–-]\s+/);
      current = { version: version.trim(), date: date.trim(), summary: '', sections: [] };
      section = null;
      releases.push(current);
      continue;
    }
    if (!current) continue;
    const heading = /^###\s+(.+)$/.exec(line);
    if (heading) {
      section = { title: heading[1]!.trim(), items: [] };
      current.sections.push(section);
      continue;
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      if (!section) {
        section = { title: '', items: [] };
        current.sections.push(section);
      }
      section.items.push(bullet[1]!.trim());
      continue;
    }
    const text = line.trim();
    if (text !== '' && !section && current.summary === '') current.summary = text;
  }
  return releases;
}

function collect(): BuildInfo {
  const env = process.env;
  const rootPkg = readJson(resolve(repoRoot, 'package.json'));
  const version = typeof rootPkg.version === 'string' ? rootPkg.version : '0.0.0';
  const commit = env.CF_PAGES_COMMIT_SHA ?? env.GITHUB_SHA ?? git(['rev-parse', 'HEAD']) ?? '';
  const branch = env.CF_PAGES_BRANCH ?? env.GITHUB_REF_NAME ?? git(['rev-parse', '--abbrev-ref', 'HEAD']) ?? '';
  const shortCommit = commit === '' ? 'local' : commit.slice(0, 7);
  const buildTime = new Date().toISOString();
  const ghRepo = env.GITHUB_REPOSITORY ? `${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY}` : null;
  let changelog = '';
  try {
    changelog = readFileSync(resolve(repoRoot, 'CHANGELOG.md'), 'utf8');
  } catch {
    changelog = '';
  }
  return {
    version,
    // Đổi theo từng lần build, kể cả build lại cùng một commit → phát hiện được mọi lần deploy.
    buildId: `${shortCommit}.${Date.now().toString(36)}`,
    commit,
    shortCommit,
    branch,
    commitMessage: git(['log', '-1', '--pretty=%s']) ?? '',
    commitTime: git(['log', '-1', '--pretty=%cI']),
    buildTime,
    repoUrl: ghRepo ?? normalizeRepoUrl(git(['remote', 'get-url', 'origin'])),
    releases: parseChangelog(changelog),
  };
}

export function versionPlugin(): Plugin {
  let info: BuildInfo | null = null;
  const deployed = (b: BuildInfo): DeployedVersion => ({ buildId: b.buildId, version: b.version, shortCommit: b.shortCommit, branch: b.branch, buildTime: b.buildTime });
  return {
    name: 'hoiminh-version',
    config() {
      info = collect();
      return { define: { __HM_BUILD__: JSON.stringify(info) } };
    },
    // Ở dev cũng phục vụ /version.json để thử luồng "có bản mới" mà không cần deploy.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/version.json')) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(info ? deployed(info) : {}));
      });
    },
    generateBundle() {
      if (!info) return;
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(deployed(info), null, 2)}\n` });
    },
  };
}
