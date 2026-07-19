import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('artifacts/api-server/src/routes/visits.ts');
const safetyRoute = read('artifacts/api-server/src/routes/visits-request-safety.ts');
const schema = read('lib/db/src/schema/index.ts');
const requestPage = read('artifacts/mustaklassat/public/original/request-visit.html');
const modeScript = read('artifacts/mustaklassat/public/original/request-visit-postponement-mode.js');
const permitScript = read('artifacts/mustaklassat/public/original/visit-permit-print.js');
const kioskScript = read('artifacts/mustaklassat/public/original/visit-center-public-kiosk.js');
const centerPage = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.html');
const centerScript = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.js');
const publicRequestPage = read('artifacts/mustaklassat/public/visit-request-form.html');
const publicPermitPage = read('artifacts/mustaklassat/public/visit-permit-download.html');

function routeBlock(source, pattern) {
  const match = source.match(pattern);
  assert.ok(match, `route block not found: ${pattern}`);
  return match[0];
}

function inlineScripts(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((source) => source.trim());
}

test('postponement state remains backed up with the original visit workflow', () => {
  assert.match(schema, /postponementStatus: text\("postponement_status", \{ enum: \["pending", "approved", "rejected"\] \}\)/);
  assert.match(schema, /postponementRequestJson: text\("postponement_request_json"\)/);
  assert.match(route, /parsedPostponement/);
  assert.match(route, /postponement: postponementSummary\(visit\)/);
});

test('existing visit postponement flow remains available', () => {
  const block = routeBlock(route, /router\.post\("\/:id\/postponement-request"[\s\S]*?\n}\);/);
  assert.match(block, /requireAuth, requireApproved/);
  assert.match(block, /requestedVisitDate <= previousVisitDate/);
  assert.match(block, /POSTPONEMENT_ALREADY_PENDING/);
});

test('hospital portal creates a deferred visit directly without an earlier visit id', () => {
  const block = routeBlock(safetyRoute, /router\.post\("\/", requireAuth, requireApproved,[\s\S]*?\n}\);/);
  assert.match(block, /body\.requestType === "deferred"/);
  assert.match(block, /DEFERRED_VISIT_REASONS/);
  assert.match(block, /postponementReasonCode/);
  assert.match(block, /postponementReasonDetails/);
  assert.match(block, /طلب زيارة مؤجلة/);
  assert.match(block, /snapshotJson: JSON\.stringify/);
  assert.doesNotMatch(block, /\/:id\/postponement-request/);
});

test('new and deferred requests use independent deduplication types', () => {
  const block = routeBlock(safetyRoute, /router\.post\("\/", requireAuth, requireApproved,[\s\S]*?\n}\);/);
  assert.match(block, /\[requestType, repId, siteLocation, systemName, subContractor, visitDate\]/);
  assert.match(block, /JSON\.parse\(String\(row\.metadata\.snapshotJson/);
  assert.match(block, /snapshot\?\.requestType === "deferred"/);
  assert.match(block, /existingRequestType === requestType/);
});

test('request portal keeps systems, companies and representatives and sends deferred metadata', () => {
  assert.match(requestPage, /id="f_system"/);
  assert.match(requestPage, /id="f_sub"/);
  assert.match(requestPage, /representative-select/);
  assert.match(requestPage, /visitRequestMode === 'deferred'/);
  assert.match(requestPage, /postponementReasonCode/);
  assert.match(requestPage, /postponementReasonDetails/);
  assert.match(requestPage, /زيارة مؤجلة/);
  assert.match(modeScript, /اختر النظام والشركة والمندوب والتاريخ كالمعتاد/);
  assert.doesNotMatch(modeScript, /اختر زيارة من طلباتك السابقة/);
});

test('kiosk keeps compatibility fields while generating one general all-sites QR', () => {
  assert.match(kioskScript, /form\.elements\.maintenanceContractorKey/);
  assert.match(kioskScript, /form\.elements\.siteName/);
  assert.match(kioskScript, /if \(!maintenanceSelect \|\| !siteSelect\)/);
  assert.doesNotMatch(kioskScript, /oldForm\.replaceWith\(form\)/);
  assert.match(kioskScript, /باركود عام لجميع المواقع/);
  assert.match(kioskScript, /body: '\{\}'/);
  assert.match(centerScript, /if \(!maintenanceSelect \|\| !siteSelect\) return/);
  assert.match(centerScript, /if \(kioskMaintenance\)/);
  assert.match(permitScript, /20260719_general_all_sites_v6/);
});

test('management decision remains stale-safe', () => {
  const block = routeBlock(route, /router\.patch\("\/management\/postponement-requests\/:id\/decision"[\s\S]*?\n}\);/);
  assert.match(block, /requireClusterVisitManagement/);
  assert.match(block, /current\.requestId !== requestId/);
  assert.match(block, /eq\(visitRequestsTable\.postponementStatus, "pending"\)/);
  assert.match(centerPage, /طلبات تأجيل الزيارات/);
  assert.match(centerScript, /data-postpone-approve/);
  assert.match(centerScript, /data-postpone-reject/);
});

test('public visit form and permit download remain protected', () => {
  const catalogBlock = routeBlock(route, /router\.get\("\/public\/request-catalog"[\s\S]*?\n}\);/);
  assert.doesNotMatch(catalogBlock, /visitRepresentativesTable|identityNumber|mobile/);
  assert.match(publicRequestPage, /\/api\/visits\/public\/request-catalog/);
  assert.match(publicRequestPage, /\/api\/visits\/public\/requests/);

  const permitBlock = routeBlock(route, /router\.get\("\/qr\/public-permit"[\s\S]*?\n}\);/);
  assert.match(permitBlock, /assertScanRate/);
  assert.match(permitBlock, /verifyPermitDownloadToken/);
  assert.match(publicPermitPage, /NajranVisitPermit\.loadPublic/);
});

test('modified visit scripts and inline page scripts are syntactically valid and avoid native dialogs', () => {
  new vm.Script(modeScript, { filename: 'request-visit-postponement-mode.js' });
  new vm.Script(permitScript, { filename: 'visit-permit-print.js' });
  new vm.Script(kioskScript, { filename: 'visit-center-public-kiosk.js' });
  for (const source of inlineScripts(requestPage)) new vm.Script(source, { filename: 'request-visit.html' });
  assert.doesNotMatch(modeScript, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
  assert.doesNotMatch(kioskScript, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
});
