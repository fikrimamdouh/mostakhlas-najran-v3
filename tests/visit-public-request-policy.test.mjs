import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const safetyRoute = read('artifacts/api-server/src/routes/visits-request-safety.ts');
const publicRequestPage = read('artifacts/mustaklassat/public/visit-request-form.html');

function routeBlock(pattern) {
  const match = safetyRoute.match(pattern);
  assert.ok(match, `route block not found: ${pattern}`);
  return match[0];
}

function inlineScripts(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((source) => source.trim());
}

test('public visit approval enforcement is centrally configurable and defaults to manual review', () => {
  assert.match(safetyRoute, /PUBLIC_REQUEST_POLICY_KEY = "visit_public_require_approved_representative_v1"/);
  assert.match(safetyRoute, /return setting\?\.value === "1"/);
  assert.match(safetyRoute, /router\.get\("\/public\/request-policy"/);
  assert.match(safetyRoute, /router\.get\("\/management\/public-request-policy"[\s\S]*?requireClusterVisitManagement/);
  assert.match(safetyRoute, /router\.post\("\/management\/public-request-policy"[\s\S]*?typeof requireApprovedRepresentative !== "boolean"/);
  assert.match(safetyRoute, /onConflictDoUpdate/);
});

test('manual mode accepts typed visitor identity while retaining central site and company validation', () => {
  const block = routeBlock(/router\.post\("\/public\/requests"[\s\S]*?\n}\);/);
  assert.match(block, /if \(requireApprovedRepresentative\) return next\(\)/);
  assert.match(block, /assertPublicVisitRequestRate/);
  assert.match(block, /visitSiteApprovalsTable/);
  assert.match(block, /visitQualificationsTable/);
  assert.doesNotMatch(block, /visitRepresentativesTable\.identityNumber/);
  assert.match(block, /submittedByContract: "PUBLIC_SITE_QR_MANUAL"/);
  assert.match(block, /verificationMode: "manual_review"/);
  assert.doesNotMatch(block, /representativeId:\s*representative/);
  assert.match(block, /sendVisitNewRequestEmail/);
});

test('public request page exposes the policy control only to an authorized management session', () => {
  assert.match(publicRequestPage, /id="admin-policy-card"[^>]*hidden/);
  assert.match(publicRequestPage, /id="require-approved-representative"/);
  assert.match(publicRequestPage, /\/api\/visits\/public\/request-policy/);
  assert.match(publicRequestPage, /\/api\/visits\/management\/public-request-policy/);
  assert.match(publicRequestPage, /الإدخال اليدوي متاح/);
  assert.match(publicRequestPage, /المطابقة مع القائمة المعتمدة إلزامية/);
  assert.match(publicRequestPage, /document\.getElementById\('admin-policy-card'\)\.hidden = false/);
  assert.doesNotMatch(publicRequestPage, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
  for (const source of inlineScripts(publicRequestPage)) new vm.Script(source, { filename: 'visit-request-form.html' });
});
