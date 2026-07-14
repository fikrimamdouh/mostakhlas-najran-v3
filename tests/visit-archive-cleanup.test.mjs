import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.html');
const cleanup = read('artifacts/mustaklassat/public/original/visit-archive-cleanup.js');
const print = read('artifacts/mustaklassat/public/original/visit-permit-print.js');

test('archive cleanup reads all visits and requires explicit manual selection', () => {
  assert.match(html, /id="archive-clean-tests"/);
  assert.match(html, /visit-archive-cleanup\.js\?v=20260714_archive_cleanup_v1/);
  assert.match(cleanup, /visibility=all/);
  assert.match(cleanup, /data-clean-visit/);
  assert.match(cleanup, /archive-clean-search/);
  assert.match(cleanup, /تحديد الظاهر/);
  assert.match(cleanup, /تنظيف المحدد/);
  assert.match(cleanup, /selectedIds\.length/);
  assert.match(cleanup, /'\/' \+ visit\.id \+ '\/archive'/);
  assert.match(cleanup, /method: 'PATCH'/);
  assert.match(cleanup, /لا يحذف السجل أو رقم التصريح أو المرفقات والتوقيعات/);
  assert.doesNotMatch(cleanup, /\/permanent/);
  assert.doesNotMatch(cleanup, /method: 'DELETE'/);
  assert.doesNotMatch(cleanup, /\b(?:alert|confirm|prompt)\s*\(/);
});

test('permit keeps signature, stamp and QR in one row and does not miniaturize the stamp', () => {
  assert.match(print, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(print, /data-role="permit-signature"[\s\S]*data-role="permit-stamp"[\s\S]*data-role="permit-qr"/);
  assert.match(print, /max-width:190px;max-height:140px/);
  assert.doesNotMatch(print, /max-width:108px;max-height:108px/);
  assert.match(html, /visit-permit-print\.js\?v=20260714_visit_center_stamp_size_v7/);
});
