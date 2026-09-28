import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './version';

describe('APP_VERSION', () => {
  it('khớp version trong package.json gốc và mục đầu CHANGELOG', () => {
    const root = resolve(__dirname, '../../..');
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };
    expect(pkg.version).toBe(APP_VERSION);
    const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
    const first = /^##\s+(\S+)/m.exec(changelog)?.[1];
    expect(first).toBe(APP_VERSION);
  });
});
