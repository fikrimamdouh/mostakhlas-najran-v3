import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectDir = fileURLToPath(new URL('../artifacts/mustaklassat/', import.meta.url));
const originalDir = path.join(projectDir, 'public/original');
const dialogVersion = '20260713_all_native_dialogs_v1';
const nativeCallPattern = /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/g;

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['dist', 'node_modules', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else if (/\.(?:html|js|mjs|cjs|ts|tsx|jsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) result.push(full);
  }
  return result;
}

test('active application contains no direct browser alert, confirm, or prompt calls', () => {
  const offenders = [];
  for (const file of walk(projectDir)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(nativeCallPattern)) {
      const line = source.slice(0, match.index).split('\n').length;
      offenders.push(`${path.relative(projectDir, file)}:${line}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('all original pages load the unified dialog before page scripts', () => {
  const htmlFiles = fs.readdirSync(originalDir).filter((name) => name.endsWith('.html'));
  assert.equal(htmlFiles.length, 39);
  for (const name of htmlFiles) {
    const source = fs.readFileSync(path.join(originalDir, name), 'utf8');
    const matches = source.match(new RegExp(`/original/system-dialogs\\.js\\?v=${dialogVersion}`, 'g')) || [];
    assert.equal(matches.length, 1, `${name} must load one unified dialog script`);
    assert.ok(
      source.indexOf('/original/system-dialogs.js') < source.indexOf('</head>'),
      `${name} must load dialogs in the document head`,
    );
    assert.equal(
      source.indexOf('<script'),
      source.indexOf('<script src="/original/system-dialogs.js'),
      `${name} must load dialogs before every page script`,
    );
  }

  const appIndex = fs.readFileSync(path.join(projectDir, 'index.html'), 'utf8');
  assert.match(appIndex, new RegExp(`/original/system-dialogs\\.js\\?v=${dialogVersion}`));
});

test('unified dialog supports accessible alert, confirm, and prompt modes', () => {
  const source = fs.readFileSync(path.join(originalDir, 'system-dialogs.js'), 'utf8');
  assert.match(source, /role=\"dialog\"/);
  assert.match(source, /aria-modal=\"true\"/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key === 'Tab'/);
  assert.match(source, /alert: function/);
  assert.match(source, /confirm: function/);
  assert.match(source, /prompt: function/);
  assert.match(source, /global\.confirm = function/);
  assert.match(source, /global\.prompt = function/);
  assert.match(source, /najran_pending_system_alert_v1/);
  assert.match(source, /DOMContentLoaded/);
});

test('every migrated confirm and prompt awaits the user decision', () => {
  const offenders = [];
  for (const file of walk(projectDir)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/window\.NajranDialogs\.(?:confirm|prompt)\s*\(/g)) {
      const prefix = source.slice(Math.max(0, match.index - 16), match.index);
      if (!/await\s*$/.test(prefix)) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${path.relative(projectDir, file)}:${line}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('submitted badge uses the structured success dialog and fresh cache version', () => {
  const flowSource = fs.readFileSync(path.join(originalDir, 'extract-submit-flow-control.js'), 'utf8');
  assert.match(flowSource, /eyebrow: 'حالة رفع المستخلص'/);
  assert.match(flowSource, /kind: 'success'/);
  assert.match(flowSource, /\{ label: 'رقم المستخلص'/);
  assert.match(flowSource, /\{ label: 'رقم الدفعة'/);
  assert.match(flowSource, /\{ label: 'الفترة'/);

  const viewerSource = fs.readFileSync(path.join(projectDir, 'src/pages/OriginalViewer.tsx'), 'utf8');
  const guardSource = fs.readFileSync(path.join(originalDir, 'hospital-storage-extract-context-guard.js'), 'utf8');
  assert.match(viewerSource, new RegExp(`extract-submit-flow-control\\.js\\?v=${dialogVersion}`));
  assert.match(guardSource, new RegExp(`extract-submit-flow-control\\.js\\?v=${dialogVersion}`));
});

test('cache rewrites did not create malformed concatenated version URLs', () => {
  const malformed = [];
  for (const file of walk(projectDir)) {
    const source = fs.readFileSync(file, 'utf8');
    if (new RegExp(`\\?v=${dialogVersion}[\"']\\s*\\+`).test(source)) {
      malformed.push(path.relative(projectDir, file));
    }
  }
  assert.deepEqual(malformed, []);
});
