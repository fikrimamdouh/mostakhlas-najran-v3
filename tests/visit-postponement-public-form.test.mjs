import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('artifacts/api-server/src/routes/visits.ts');
const schema = read('lib/db/src/schema/index.ts');
const requestPage = read('artifacts/mustaklassat/public/original/request-visit.html');
const permitScript = read('artifacts/mustaklassat/public/original/visit-permit-print.js');
const centerPage = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.html');
const centerScript = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.js');
const publicRequestPage = read('artifacts/mustaklassat/public/visit-request-form.html');
const publicPermitPage = read('artifacts/mustaklassat/public/visit-permit-download.html');

function routeBlock(pattern) {
  const match = route.match(pattern);
  assert.ok(match, `route block not found: ${pattern}`);
  return match[0];
}

function inlineScripts(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]).filter((source) => source.trim());
}

test('postponement state is backed up with the visit and indexed for the management queue', () => {
  assert.match(schema, /postponementStatus: text\("postponement_status", \{ enum: \["pending", "approved", "rejected"\] \}\)/);
  assert.match(schema, /postponementRequestJson: text\("postponement_request_json"\)/);
  assert.match(schema, /visit_requests_postponement_status_idx/);
  assert.match(route, /parsedPostponement/);
  assert.match(route, /history: PostponementEntry\[\]/);
  assert.match(route, /postponement: postponementSummary\(visit\)/);
});

test('site postponement requests are authorized, later than the current visit and validity checked before queueing', () => {
  const block = routeBlock(/router\.post\("\/:id\/postponement-request"[\s\S]*?\n}\);/);
  assert.match(block, /requireAuth, requireApproved/);
  assert.match(block, /canAccessVisit\(req\.currentUser, context\.visit\)/);
  assert.match(block, /requestedVisitDate <= previousVisitDate/);
  assert.match(block, /isDateWithin\(requestedDay, context\.siteApproval\.validFrom, context\.siteApproval\.validUntil\)/);
  assert.match(block, /isDateWithin\(requestedDay, context\.qualification\.validFrom, context\.qualification\.validUntil\)/);
  assert.match(block, /POSTPONEMENT_ALREADY_PENDING/);
  assert.match(block, /postponementStatus: "pending"/);
  assert.match(block, /طلب تأجيل زيارة من الموقع/);
});

test('management decision is stale-safe and changes the visit date only on approval', () => {
  const block = routeBlock(/router\.patch\("\/management\/postponement-requests\/:id\/decision"[\s\S]*?\n}\);/);
  assert.match(block, /requireClusterVisitManagement/);
  assert.match(block, /current\.requestId !== requestId/);
  assert.match(block, /eq\(visitRequestsTable\.postponementStatus, "pending"\)/);
  assert.match(block, /if \(decision === "approved"\) visitValues\.visitDate = current\.requestedVisitDate/);
  assert.match(block, /update\(visitRequestMetadataTable\)\.set\(\{ startsAt: nextStartsAt, endsAt: nextEndsAt/);
  assert.match(block, /الموافقة على طلب تأجيل زيارة/);
  assert.match(block, /رفض طلب تأجيل زيارة/);
  assert.match(route, /pendingPostponements/);
  assert.match(centerPage, /طلبات تأجيل الزيارات/);
  assert.match(centerScript, /data-postpone-approve/);
  assert.match(centerScript, /data-postpone-reject/);
});

test('request portal shows site reasons and submits postponement without native browser dialogs', () => {
  assert.match(permitScript, /NajranVisitPostponement/);
  assert.match(permitScript, /سبب الموقع للتأجيل/);
  assert.match(permitScript, /postponement-request/);
  assert.match(permitScript, /موعد الزيارة الحالي حتى صدور القرار/);
  assert.match(requestPage, /20260716_postponement_download_qr_v9/);
  assert.doesNotMatch(permitScript, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
});

test('public visit form uses sanitized catalogue data and server-side representative matching', () => {
  const catalogBlock = routeBlock(/router\.get\("\/public\/request-catalog"[\s\S]*?\n}\);/);
  assert.doesNotMatch(catalogBlock, /visitRepresentativesTable|identityNumber|mobile/);
  assert.match(catalogBlock, /visitSiteApprovalsTable/);
  assert.match(catalogBlock, /visitQualificationsTable/);

  const requestBlock = routeBlock(/router\.post\("\/public\/requests"[\s\S]*?\n}\);/);
  assert.doesNotMatch(requestBlock, /requireAuth|requireApproved/);
  assert.match(requestBlock, /assertPublicVisitRequestRate/);
  assert.match(requestBlock, /visitRepresentativesTable\.identityNumber/);
  assert.match(requestBlock, /normalizedSaudiMobile\(representative\.mobile\) === normalizedSaudiMobile\(submittedMobile\)/);
  assert.match(requestBlock, /representativeSystems\.some/);
  assert.match(requestBlock, /pg_advisory_xact_lock/);
  assert.match(requestBlock, /PUBLIC_SITE_QR/);
  assert.match(requestBlock, /ensurePermitToken\(tx, visit\.id\)/);
  assert.match(publicRequestPage, /<title>نموذج طلب زيارة<\/title>/);
  assert.match(publicRequestPage, /\/api\/visits\/public\/request-catalog/);
  assert.match(publicRequestPage, /\/api\/visits\/public\/requests/);
  assert.match(publicRequestPage, /لا تعرض الصفحة العامة أسماء المندوبين/);
});

test('site QR poster is generated by the protected center and links to the public request form', () => {
  const block = routeBlock(/router\.post\("\/management\/request-form-qr"[\s\S]*?\n}\);/);
  assert.match(block, /requireClusterVisitManagement/);
  assert.match(block, /visit-request-form\.html/);
  assert.match(block, /QRCode\.toDataURL/);
  assert.match(centerPage, /باركود نموذج طلب زيارة للموقع/);
  assert.match(centerScript, /kiosk-download-pdf/);
  assert.match(centerScript, /kiosk-download-png/);
  assert.match(centerScript, /html2canvas\(poster/);
});

test('approved permit contains a second smaller download QR backed by a token-protected public PDF page', () => {
  assert.match(route, /visit-permit-download\.html/);
  assert.match(route, /downloadQrDataUrl/);
  assert.match(permitScript, /data-role="permit-download-qr"/);
  assert.match(permitScript, /width:64px;height:64px/);
  assert.match(permitScript, /تحميل النموذج<br>على الجوال/);
  const block = routeBlock(/router\.get\("\/qr\/public-permit"[\s\S]*?\n}\);/);
  assert.match(block, /assertScanRate/);
  assert.match(block, /verifyPermitDownloadToken/);
  assert.match(block, /decryptPermitToken\(row\.qr\.tokenCiphertext\)/);
  assert.doesNotMatch(block, /tokenHashesMatch/);
  assert.match(block, /row\.visit\.status !== "approved"/);
  assert.match(block, /Cache-Control", "no-store"/);
  assert.match(publicPermitPage, /NajranVisitPermit\.loadPublic/);
  assert.match(publicPermitPage, /NajranVisitPermit\.printPayload/);
  assert.match(publicPermitPage, /نسخة إلكترونية مطابقة للنموذج المعتمد/);
});

test('new public pages and modified visit scripts are syntactically valid and avoid native dialogs', () => {
  new vm.Script(permitScript, { filename: 'visit-permit-print.js' });
  new vm.Script(centerScript, { filename: 'cluster-subcontractor-visits.js' });
  for (const [name, html] of [['visit-request-form.html', publicRequestPage], ['visit-permit-download.html', publicPermitPage]]) {
    for (const source of inlineScripts(html)) new vm.Script(source, { filename: name });
    assert.doesNotMatch(html, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
  }
});
