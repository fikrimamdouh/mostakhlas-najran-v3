import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const schemaGuard = read('artifacts/api-server/src/routes/visits-schema-guard.ts');
const routeIndex = read('artifacts/api-server/src/routes/index.ts');
const centerAdminScript = read('artifacts/mustaklassat/public/original/visit-archive-cleanup.js');

test('visit schema update is additive, automatic and mounted before all visit routes', () => {
  const guardPosition = routeIndex.indexOf('router.use("/visits", visitsSchemaGuardRouter)');
  const safetyPosition = routeIndex.indexOf('router.use("/visits", visitsRequestSafetyRouter)');
  const visitsPosition = routeIndex.indexOf('router.use("/visits", visitsRouter)');
  assert.ok(guardPosition >= 0 && guardPosition < safetyPosition && safetyPosition < visitsPosition);
  assert.match(schemaGuard, /add column if not exists "postponement_status" text/i);
  assert.match(schemaGuard, /add column if not exists "postponement_request_json" text/i);
  assert.match(schemaGuard, /create index if not exists "visit_requests_postponement_status_idx"/i);
  assert.match(schemaGuard, /pg_advisory_xact_lock\(94022, 1\)/);
  assert.doesNotMatch(schemaGuard, /\b(?:drop|truncate|delete\s+from)\b/i);
});

test('policy switch is available only inside the visit center while the QR remains public', () => {
  assert.match(schemaGuard, /x-visit-policy-admin/);
  assert.match(schemaGuard, /visit-center-v1/);
  assert.match(schemaGuard, /return res\.status\(404\)/);
  assert.match(centerAdminScript, /visit-public-policy-admin/);
  assert.match(centerAdminScript, /X-Visit-Policy-Admin/);
  assert.match(centerAdminScript, /الباركود عام ومفتوح لأي زائر/);
  assert.match(centerAdminScript, /صفحة الزائر العامة لا تعرض أي أدوات إدارية ولا تحتاج إلى تسجيل دخول/);
  assert.doesNotMatch(centerAdminScript, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
  new vm.Script(centerAdminScript, { filename: 'visit-archive-cleanup.js' });
});
