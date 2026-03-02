/* eslint-disable security/detect-non-literal-fs-filename */
import { getConsentCategoryForEvent } from '@/lib/analytics/consent/consent-gating';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function gatherFiles(dir: string, exts = ['.ts', '.tsx', '.js', '.jsx']) {
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build'].includes(e.name)) continue;
      out.push(...gatherFiles(full, exts));
    } else if (exts.includes(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

describe('Analytics mapping coverage', () => {
  it('ensures all Analytics.track event names are mapped', () => {
    const roots = ['app', 'components', 'lib', 'hooks', 'Screens'];
    const files: string[] = [];
    for (const r of roots) {
      const dir = path.resolve(process.cwd(), r);
      if (fs.existsSync(dir)) files.push(...gatherFiles(dir));
    }

    const regex = /Analytics\.track\s*\(\s*['"`]([a-zA-Z0-9_:\-]+)['"`]/g;
    const found = new Set<string>();

    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content))) {
        found.add(m[1]);
      }
    }

    // Ensure every discovered event has a mapping (or runtime override)
    const unmapped: string[] = [];
    for (const name of Array.from(found)) {
      const cat = getConsentCategoryForEvent(undefined, name);
      if (cat === null) unmapped.push(name);
    }

    expect(unmapped).toEqual([]);
  });
});
