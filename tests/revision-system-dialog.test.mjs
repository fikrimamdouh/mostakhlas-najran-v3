import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const originalDir = fileURLToPath(
  new URL('../artifacts/mustaklassat/public/original/', import.meta.url),
);
const revisionSource = fs.readFileSync(
  path.join(originalDir, 'revision-local-draft-restore.js'),
  'utf8',
);
const authSource = fs.readFileSync(path.join(originalDir, 'auth-check.js'), 'utf8');
const dialogVersion = '20260713_system_dialogs_v1';

test('revision context uses accessible in-system dialogs instead of browser dialogs', () => {
  assert.doesNotMatch(revisionSource, /\b(?:alert|confirm|prompt)\s*\(/);
  assert.match(revisionSource, /function showNajranSystemDialog\s*\(/);
  assert.match(revisionSource, /role="dialog"/);
  assert.match(revisionSource, /aria-modal="true"/);
  assert.match(revisionSource, /event\.key === 'Escape'/);
  assert.match(revisionSource, /window\.NajranSystemDialog = showNajranSystemDialog/);
});

test('green work-context badge opens the professional status dialog', () => {
  assert.match(revisionSource, /حالة العمل الحالية/);
  assert.match(revisionSource, /أنت تعمل على مستخلص جديد \/ جاري/);
  assert.match(revisionSource, /الحفظ المحلي التلقائي نشط/);
  assert.match(revisionSource, /رقم الدفعة/);
  assert.match(revisionSource, /الفترة/);
});

test('destructive revision actions require colored system confirmations', () => {
  assert.match(revisionSource, /kind: 'danger',[\s\S]*title: 'حذف المسودة المحلية\؟'/);
  assert.match(revisionSource, /kind: 'warning',[\s\S]*title: 'بدء مستخلص جديد\؟'/);
  assert.match(revisionSource, /dismissOnBackdrop: false/g);
});

test('auth loader and every preload use the dedicated dialog cache version', () => {
  assert.match(
    authSource,
    new RegExp(`var REVISION_DRAFT_V = '${dialogVersion}'`),
  );
  assert.match(
    authSource,
    /revision-local-draft-restore\.js\?v=' \+ REVISION_DRAFT_V/,
  );

  const htmlFiles = fs.readdirSync(originalDir).filter((name) => name.endsWith('.html'));
  const preloads = htmlFiles.flatMap((name) => {
    const source = fs.readFileSync(path.join(originalDir, name), 'utf8');
    return [...source.matchAll(/revision-local-draft-restore\.js\?v=([^\"']+)/g)]
      .map((match) => ({ name, version: match[1] }));
  });

  assert.ok(preloads.length > 0, 'expected revision-local-draft preloads');
  assert.deepEqual(
    [...new Set(preloads.map(({ version }) => version))],
    [dialogVersion],
  );
});
