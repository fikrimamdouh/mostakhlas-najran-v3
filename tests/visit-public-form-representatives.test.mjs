import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routeIndex = read('artifacts/api-server/src/routes/index.ts');
const publicFormRoute = read('artifacts/api-server/src/routes/visits-public-form.ts');
const publicPage = read('artifacts/mustaklassat/public/visit-request-form.html');

function inlineScripts(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((source) => source.trim());
}

test('public representative route is mounted before the legacy visit routers', () => {
  assert.match(routeIndex, /import visitsPublicFormRouter from "\.\/visits-public-form"/);
  assert.ok(routeIndex.indexOf('visitsPublicFormRouter') < routeIndex.indexOf('visitsRequestSafetyRouter'));
  assert.match(routeIndex, /router\.use\("\/visits", visitsPublicFormRouter\)/);
});

test('public representative endpoint returns only filtered names and masked identities', () => {
  assert.match(publicFormRoute, /router\.get\("\/public\/representatives"/);
  assert.match(publicFormRoute, /visitSiteApprovalsTable/);
  assert.match(publicFormRoute, /visitQualificationsTable/);
  assert.match(publicFormRoute, /visitRepresentativeSystemsTable/);
  assert.match(publicFormRoute, /identityMasked: maskIdentity\(row\.identityNumber\)/);
  assert.doesNotMatch(publicFormRoute, /mobile:/);
  assert.doesNotMatch(publicFormRoute, /identityNumber: row\.identityNumber/);
});

test('public form shows systems first, then approved companies and representatives or a new representative', () => {
  assert.match(publicPage, /id="system"/);
  assert.match(publicPage, /id="representative"/);
  assert.match(publicPage, /\/api\/visits\/public\/representatives/);
  assert.match(publicPage, /newRepresentative:'إضافة مندوب جديد'/);
  assert.match(publicPage, /representativeMode:approvedRepresentative\?'approved':'new'/);
  assert.match(publicPage, /Array\.isArray\(catalog\.systems\)\?catalog\.systems\.slice\(\):\[\]/);
  assert.doesNotMatch(publicPage, /row\.isActive&&\(isOther\|\|allowed\[row\.id\]\)/);
  for (const source of inlineScripts(publicPage)) new vm.Script(source, { filename: 'visit-request-form.html' });
  assert.doesNotMatch(publicPage, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
});
