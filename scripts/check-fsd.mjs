#!/usr/bin/env node
/**
 * Feature-Sliced Design boundary check.
 *
 * Three rules, all of which the codebase currently satisfies — the point is to keep it that way:
 *
 *   1. Layers only import downwards: app → widgets → features → entities → shared.
 *   2. Slices on the same layer don't import each other, except through an explicit `@x` entry
 *      point (see `entities/section/@x/pack.ts`).
 *   3. A slice is entered through its `index.ts`; reaching into `@/<layer>/<slice>/<file>` from
 *      outside that slice is not allowed.
 *
 * `shared` is exempt from 2 and 3: it is segment-organised (`shared/lib/uid`), not slice-organised.
 * `app` is one unit — Next's router owns its internal structure.
 *
 * Run: npm run lint:fsd
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = 'src';
const LAYERS = ['shared', 'entities', 'features', 'widgets', 'app'];
const rank = (layer) => LAYERS.indexOf(layer);

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/** `src/entities/board/api/storage.ts` → `{ layer: 'entities', slice: 'board' }` */
function locate(file) {
  const [layer, slice] = relative(SRC, file).split('/');
  if (!LAYERS.includes(layer)) return null;
  return { layer, slice: layer === 'app' || layer === 'shared' ? null : slice };
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+'(@\/[^']+)'/g;

const violations = [];

for (const file of sourceFiles(SRC)) {
  const from = locate(file);
  if (!from) continue;
  const text = readFileSync(file, 'utf8');

  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1];
    const [layer, slice, ...rest] = spec.slice(2).split('/');
    if (!LAYERS.includes(layer)) continue;

    const line = text.slice(0, match.index + match[0].length).split('\n').length;
    const at = `${file}:${line}`;

    if (rank(layer) > rank(from.layer)) {
      violations.push(`${at}\n    imports upwards: ${from.layer} → ${layer} (${spec})`);
      continue;
    }

    if (layer === 'shared' || layer === 'app') continue;

    const crossImport = rest[0] === '@x';
    if (layer === from.layer && slice !== from.slice && !crossImport) {
      violations.push(`${at}\n    cross-slice on the same layer: ${from.slice} → ${slice} (${spec})`);
      continue;
    }

    if (rest.length > 0 && slice !== from.slice && !crossImport) {
      violations.push(`${at}\n    sidesteps the slice's public API (${spec})`);
    }
  }
}

if (violations.length) {
  console.error(`FSD: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(`  ${v}\n`);
  process.exit(1);
}
console.log('FSD: boundaries are clean');
