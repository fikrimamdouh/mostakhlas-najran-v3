import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = fs.readFileSync(
  path.join(root, 'artifacts/mustaklassat/public/original/visit-central-approval.js'),
  'utf8',
);

test('quick representative selection restores the exact linked company record', () => {
  assert.match(source, /function ensureExactOption/);
  assert.match(source, /async function repairDirectSavedRepresentative/);
  assert.match(source, /representative\.contractorId/);
  assert.match(source, /ensureExactOption\(contractorSelect, contractor, 'مرتبطة بالمندوب'\)/);
  assert.match(source, /renderExactRepresentativeChoices/);
  assert.match(source, /direct-saved-representative/);
});

test('representative directory can edit company without changing identity or system links', () => {
  assert.match(source, /data-edit-representative-company/);
  assert.match(source, /تعديل شركة المندوب/);
  assert.match(source, /api\('\/management\/representatives\/' \+ representativeId/);
  assert.match(source, /JSON\.stringify\(\{ contractorId: contractorId \}\)/);
  assert.match(source, /Number\(result\.representative\.contractorId\) !== contractorId/);
  assert.match(source, /لا تُعدّل بيانات الزيارات القديمة أو أرقام الهوية أو روابط الأنظمة/);
  assert.doesNotMatch(source, /identityNumber:\s*form/);
});

test('archive labels completed visits without changing the stored expired status', () => {
  assert.match(source, /option\[value="expired"\]/);
  assert.match(source, /تمت الزيارة/);
  assert.match(source, /\.badge-expired/);
  assert.doesNotMatch(source, /value\s*=\s*['"]completed['"]/);
});
