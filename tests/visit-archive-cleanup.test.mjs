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

test('archive cleanup is explicit, restricted and uses the existing protected permanent-delete route', () => {
  assert.match(html, /id="archive-clean-tests"/);
  assert.match(html, /visit-archive-cleanup\.js\?v=20260714_archive_cleanup_v1/);
  assert.match(cleanup, /archive-clean-tests/);
  assert.match(cleanup, /visibility=archived&status=cancelled/);
  assert.match(cleanup, /TEST_REASON_PATTERN = \/تجريب\/u/);
  assert.match(cleanup, /!!visit\.archivedAt && visit\.status === 'cancelled'/);
  assert.match(cleanup, /!!visit\.hasSignedPermit/);
  assert.match(cleanup, /facilityApproval && visit\.facilityApproval\.status === 'approved'/);
  assert.match(cleanup, /confirmation: 'DELETE:' \+/);
  assert.match(cleanup, /\/' \+ visit\.id \+ '\/permanent'/);
  assert.match(cleanup, /سجل التدقيق/);
  assert.doesNotMatch(cleanup, /\b(?:alert|confirm|prompt)\s*\(/);
});

test('permit keeps signature, stamp and QR in one row and does not miniaturize the stamp', () => {
  assert.match(print, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(print, /data-role="permit-signature"[\s\S]*data-role="permit-stamp"[\s\S]*data-role="permit-qr"/);
  assert.match(print, /max-width:190px;max-height:140px/);
  assert.doesNotMatch(print, /max-width:108px;max-height:108px/);
  assert.match(html, /visit-permit-print\.js\?v=20260714_visit_center_stamp_size_v7/);
});
