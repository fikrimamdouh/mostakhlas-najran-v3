import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routesIndex = read('artifacts/api-server/src/routes/index.ts');
const safetyRoute = read('artifacts/api-server/src/routes/visits-request-safety.ts');
const requestSafety = read('artifacts/mustaklassat/public/original/visit-permit-print.js');

test('visit request API serializes and reuses identical active visits', () => {
  assert.match(routesIndex, /visitsRequestSafetyRouter/);
  assert.match(routesIndex, /router\.use\("\/visits", visitsRequestSafetyRouter\);[\s\S]*router\.use\("\/visits", visitsRouter\);/);
  assert.match(safetyRoute, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(safetyRoute, /visitRequestsTable\.repId/);
  assert.match(safetyRoute, /visitRequestsTable\.siteLocation/);
  assert.match(safetyRoute, /visitRequestsTable\.systemName/);
  assert.match(safetyRoute, /visitRequestsTable\.visitDate/);
  assert.match(safetyRoute, /ne\(visitRequestsTable\.status, "cancelled"\)/);
  assert.match(safetyRoute, /duplicate: true, code: "VISIT_ALREADY_EXISTS"/);
  assert.match(safetyRoute, /منع تكرار طلب زيارة مقاول باطن/);
});

test('request page safety refreshes auth and blocks duplicate client submissions', () => {
  assert.match(requestSafety, /request-visit\\\.html/);
  assert.match(requestSafety, /request-visit-safe-refresh/);
  assert.match(requestSafety, /تحديث آمن/);
  assert.match(requestSafety, /response\.status === 401 && !retried/);
  assert.match(requestSafety, /freshToken\(true\)/);
  assert.match(requestSafety, /event\.stopImmediatePropagation\(\)/);
  assert.match(requestSafety, /requestSubmitting/);
  assert.match(requestSafety, /new Set\(representativeIds\)\.size !== representativeIds\.length/);
  assert.match(requestSafety, /VISIT_ALREADY_EXISTS/);
  assert.match(requestSafety, /تم اختيار نفس المندوب أكثر من مرة/);
  assert.doesNotMatch(requestSafety, /(^|[^.\w])(?:alert|confirm|prompt)\s*\(/m);
});
