import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const hotfix = read('artifacts/api-server/src/routes/visits-direct-setup-hotfix.ts');
const routes = read('artifacts/api-server/src/routes/index.ts');

test('direct setup accepts a normal non-empty company name without forcing a legal-form prefix', () => {
  assert.match(hotfix, /if \(!requestedContractorId && !companyName\)/);
  assert.doesNotMatch(hotfix, /isFullCompanyName/);
  assert.doesNotMatch(hotfix, /يبدأ بكلمة شركة|اكتب الاسم الرسمي الكامل/);
});

test('direct setup avoids ON CONFLICT dependency for qualification and site approval writes', () => {
  assert.match(hotfix, /async function upsertSiteApproval/);
  assert.match(hotfix, /async function upsertQualification/);
  assert.match(hotfix, /select\(\)\.from\(visitSiteApprovalsTable\)/);
  assert.match(hotfix, /update\(visitSiteApprovalsTable\)/);
  assert.match(hotfix, /insert\(visitSiteApprovalsTable\)/);
  assert.doesNotMatch(hotfix, /onConflictDoUpdate/);
});

test('hotfix route is mounted before the legacy visits router', () => {
  const hotfixUse = routes.indexOf('router.use("/visits", visitsDirectSetupHotfixRouter);');
  const legacyUse = routes.indexOf('router.use("/visits", visitsRouter);');
  assert.ok(hotfixUse >= 0);
  assert.ok(legacyUse >= 0);
  assert.ok(hotfixUse < legacyUse);
});

test('audit failure cannot convert a committed setup into a false 500', () => {
  assert.match(hotfix, /try \{\s*await logAudit\(/);
  assert.match(hotfix, /Direct setup committed but audit logging failed/);
  assert.match(hotfix, /return res\.status\(result\.createdCompany \? 201 : 200\)\.json/);
});
