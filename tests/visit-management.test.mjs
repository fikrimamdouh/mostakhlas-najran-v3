import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('artifacts/api-server/src/routes/visits.ts');
const security = read('artifacts/api-server/src/lib/visit-security.ts');
const middleware = read('artifacts/api-server/src/middleware/requireClusterVisitManagement.ts');
const requireAuthSource = read('artifacts/api-server/src/middleware/requireAuth.ts');
const schema = read('lib/db/src/schema/index.ts');
const center = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.html');
const centerJs = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.js');
const printJs = read('artifacts/mustaklassat/public/original/visit-permit-print.js');
const requestVisit = read('artifacts/mustaklassat/public/original/request-visit.html');
const authCheck = read('artifacts/mustaklassat/public/original/auth-check.js');
const require = createRequire(import.meta.url);
const compiledSecurity = ts.transpileModule(security, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const securityModule = { exports: {} };
new Function('require', 'module', 'exports', compiledSecurity)(require, securityModule, securityModule.exports);
const visitSecurity = securityModule.exports;

test('cluster visit management permission is database-only and fails closed for admins too', () => {
  assert.match(security, /CLUSTER_VISIT_PERMISSION = "cluster_visit_management"/);
  assert.match(middleware, /hasClusterVisitManagement\(user\)/);
  assert.doesNotMatch(middleware, /user\.role|user\.email|\["admin"|\["supervisor"/);
  assert.match(middleware, /status\(403\)/);
  assert.ok((route.match(/requireClusterVisitManagement/g) || []).length >= 20);
  assert.match(authCheck, /moduleKey === 'cluster_visit_management'[\s\S]*allowed !== null/);
});

test('security helpers enforce exact permissions, masking, validation, magic bytes, ZIP limits and opaque QR tokens at runtime', () => {
  assert.equal(visitSecurity.hasClusterVisitManagement({ role: 'admin', email: 'admin@example.com', allowedModules: '[]' }), false);
  assert.equal(visitSecurity.hasClusterVisitManagement({ role: 'user', allowedModules: '["cluster_visit_management"]' }), true);
  assert.notEqual(visitSecurity.maskIdentity('1234567890'), '1234567890');
  assert.equal(visitSecurity.isValidSaudiMobile('0512345678'), true);
  assert.equal(visitSecurity.isValidSaudiMobile('123'), false);
  assert.equal(visitSecurity.parseIsoDate('2026-02-30'), null);
  assert.ok(visitSecurity.parseIsoDate('2026-02-28'));
  const openEnded = visitSecurity.validateVisitWindow('2026-07-15T08:00:00.000Z', null);
  assert.equal(openEnded.endsAt, null);
  assert.deepEqual(visitSecurity.detectVisitFile(Buffer.from('%PDF-1.7\n')), { mimeType: 'application/pdf', extension: 'pdf' });
  assert.equal(visitSecurity.detectVisitFile(Buffer.from('not a pdf')), null);
  assert.throws(() => visitSecurity.validateZipEntries([{ entryName: '../escape.json', header: { size: 10, compressedSize: 10 } }]));
  assert.throws(() => visitSecurity.validateZipEntries([{ entryName: 'bomb.json', header: { size: 10100, compressedSize: 100 } }]));
  const previousSecret = process.env.VISIT_QR_SECRET;
  process.env.VISIT_QR_SECRET = 'visit-test-secret-with-sufficient-entropy';
  try {
    const generated = visitSecurity.createPermitToken();
    assert.match(generated.token, /^[A-Za-z0-9_-]+$/);
    assert.equal(generated.token.includes('1234567890'), false);
    assert.equal(generated.tokenHash, visitSecurity.sha256(generated.token));
    assert.equal(visitSecurity.decryptPermitToken(generated.tokenCiphertext), generated.token);
    assert.equal(visitSecurity.tokenHashesMatch(generated.token, generated.tokenHash), true);
    assert.equal(visitSecurity.tokenHashesMatch(generated.token + 'x', generated.tokenHash), false);
  } finally {
    if (previousSecret === undefined) delete process.env.VISIT_QR_SECRET;
    else process.env.VISIT_QR_SECRET = previousSecret;
  }
});

test('visits and documents are soft-cancelled or disabled instead of deleted', () => {
  assert.match(route, /router\.patch\("\/:id\/cancel"/);
  assert.match(route, /status: "cancelled"/);
  assert.match(route, /router\.delete\("\/:id"[\s\S]*status\(405\)/);
  assert.match(route, /status: "disabled", disabledAt: new Date\(\)/);
  assert.doesNotMatch(route, /db\.delete\(visitRequestsTable\)|db\.delete\(visitDocumentsTable\)/);
  assert.match(route, /router\.get\("\/:id\/signed-permit"[\s\S]*canAccessVisit\(req\.currentUser, context\.visit\)/);
});

test('permit numbers use one atomic database upsert and have a uniqueness backstop', () => {
  assert.match(route, /onConflictDoUpdate\([\s\S]*visitNumberSequencesTable\.lastValue} \+ 1/);
  assert.match(route, /returning\(\{ lastValue: visitNumberSequencesTable\.lastValue \}\)/);
  assert.match(schema, /visit_number_sequences[\s\S]*scopeKey: text\("scope_key"\)\.notNull\(\)\.unique\(\)/);
  assert.match(schema, /visit_requests_atomic_serial_unique/);
  assert.match(schema, /visit_number_sequences/);
});

test('reissue creates a new visit, metadata and QR without updating the original visit', () => {
  const block = route.match(/router\.post\("\/:id\/reissue"[\s\S]*?\n}\);/);
  assert.ok(block, 'reissue route must exist');
  assert.match(block[0], /insert\(visitRequestsTable\)/);
  assert.match(block[0], /reissuedFromVisitId: originalId/);
  assert.match(block[0], /insert\(visitRequestMetadataTable\)/);
  assert.match(block[0], /ensurePermitToken\(tx, copy\.id\)/);
  assert.doesNotMatch(block[0], /update\(visitRequestsTable\)[\s\S]*originalId/);
});

test('document and ZIP security check bytes, MIME, hashes, paths, expansion and duplicates', () => {
  assert.match(security, /subarray\(0, 5\).*%PDF-/s);
  assert.match(security, /image\/jpeg/);
  assert.match(security, /image\/png/);
  assert.match(security, /safe\.startsWith\("\.\.\/"\)/);
  assert.match(security, /expanded \/ compressed > 100/);
  assert.match(security, /MAX_VISIT_ZIP_EXPANDED_BYTES/);
  assert.match(route, /DUPLICATE_DOCUMENT/);
  assert.match(schema, /visit_documents_content_unique/);
});

test('QR uses random tokens, stores hash plus ciphertext, rate limits scans and never embeds identity fields', () => {
  assert.match(security, /randomBytes\(32\)/);
  assert.match(security, /tokenHash: sha256\(token\)/);
  assert.match(security, /aes-256-gcm/);
  assert.match(schema, /token_hash/);
  assert.match(schema, /token_ciphertext/);
  assert.match(route, /recent\.length >= 30/);
  const qrPayload = route.match(/QRCode\.toDataURL\(([\s\S]*?), \{ errorCorrectionLevel/);
  assert.ok(qrPayload);
  assert.doesNotMatch(qrPayload[1], /repId|repName|identity|mobile|visitId/);
  assert.match(qrPayload[1], /original-viewer\?page=cluster-subcontractor-visits\.html&visitQr=/);
});

test('approved certificate catalogue uses full display names and seeds the supplied qualification dates', () => {
  assert.match(route, /APPROVED_SUBCONTRACTOR_CATALOG/);
  const officialSystems = [
    'تعقيم ونظافة مجاري الهواء والدكتات',
    'صيانة أنظمة التكييف والتبريد وأنظمة التهوية',
    'صيانة المصاعد الكهربائية',
    'صيانة وإصلاح نظام إطفاء الحريق',
    'صيانة وإصلاح نظام إنذار الحريق',
    'صيانة السنترالات والنداء الآلي والإذاعة الداخلية والساعة المركزية واستدعاء الممرضات',
    'صيانة محطات التوليد الكهربائية ولوحات التحكم والتشغيل و(ATS)',
    'صيانة شبكة الغازات الطبية وملحقاتها وخزانات الغاز',
    'صيانة الـ (UPS)',
    'صيانة محولات الكهرباء والقواطع الكهربائية وكامل اللوحات الكهربائية',
    'صيانة معدات المغسلة',
    'صيانة محطات تحلية مياه الشرب وملحقاتها',
    'صيانة محطة معالجة مياه الصرف الصحي',
    'مكافحة الحشرات والقوارض والآفات البيئية',
    'صيانة ثلاجة الموتى',
    'صيانة نظم المراقبات الأمنية',
    'عمرات المولدات',
  ];
  for (const system of officialSystems) assert.match(route, new RegExp(system.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const contractor of ['مؤسسة أفق الحجاز المحدودة', 'شركة المفردون للمقاولات', 'شركة دائرة التحكم', 'مؤسسة نبراس حنين لأنظمة السلامة', 'شركة إيكوفا للمقاولات']) assert.match(route, new RegExp(contractor));
  const catalogBlock = route.match(/const APPROVED_SUBCONTRACTOR_CATALOG[\s\S]*?\] as const;/);
  assert.ok(catalogBlock);
  assert.deepEqual([...catalogBlock[0].matchAll(/\{ system: "([^"]+)"/g)].map((match) => match[1]), officialSystems);
  assert.doesNotMatch(catalogBlock[0], /validFrom|validUntil/);
  assert.match(route, /isOutdatedCatalogSystem/);
  assert.match(route, /systemsDisabled/);
  assert.match(route, /set\(\{ isActive: false, updatedAt: new Date\(\) \}\)/);
  const certificateBlock = route.match(/const QUALIFICATION_CERTIFICATES[\s\S]*?\] as const;/);
  assert.ok(certificateBlock);
  assert.match(certificateBlock[0], /MOH-MAIN-2026-023/);
  assert.match(certificateBlock[0], /validFrom: "2026-05-17"/);
  assert.match(certificateBlock[0], /validUntil: "2027-12-31"/);
  assert.doesNotMatch(certificateBlock[0], /identityNumber|repId|residenceExpiresAt/);
  assert.match(route, /مزامنة أسماء مقاولي الباطن المعتمدين/);
  assert.match(route, /seedCertificateQualifications/);
  assert.match(route, /approvedPersonnel: approvedPersonnelResponse/);
  assert.match(centerJs, /approvedSubcontractors/);
});

test('direct issue uses the maintenance-contractor site catalogue and permits an optional end date', () => {
  assert.match(route, /key: "بيت_العرب"/);
  assert.match(route, /key: "سراكو"/);
  assert.match(route, /الموقع المحدد لا يتبع مقاول الصيانة المختار/);
  assert.match(route, /endsAtProvided: !!window\.endsAt/);
  assert.match(center, /تاريخ نهاية الزيارة \(اختياري\)/);
  assert.match(centerJs, /body\.endsAt = dateOnlyIso\(body\.endsAt, true\)/);
  assert.match(centerJs, /dateOnlyIso\(body\.startsAt, false\)/);
});

test('direct issue can complete a company, site approval and representative without leaving the screen', () => {
  for (const id of ['direct-add-contractor', 'direct-complete-approval', 'direct-add-representative']) assert.match(center, new RegExp(`id="${id}"`));
  assert.match(centerJs, /\/management\/direct-setup/);
  assert.match(centerJs, /\/management\/direct-representative/);
  assert.match(centerJs, /approvedPersonnel/);
  const setup = route.match(/router\.post\("\/management\/direct-setup"[\s\S]*?\n}\);/);
  assert.ok(setup);
  assert.match(setup[0], /db\.transaction/);
  assert.match(setup[0], /visitQualificationsTable/);
  assert.match(setup[0], /visitSiteApprovalsTable/);
  assert.match(setup[0], /await audit/);
  const representative = route.match(/router\.post\("\/management\/direct-representative"[\s\S]*?\n}\);/);
  assert.ok(representative);
  assert.match(representative[0], /visitRepresentativeSystemsTable/);
  assert.match(representative[0], /maskIdentity/);
  assert.match(representative[0], /onConflictDoUpdate/);
  assert.match(representative[0], /reusedExisting/);
  const response = representative[0].match(/return res\.status\(result\.created \? 201 : 200\)\.json\([\s\S]*?reusedExisting:[\s\S]*?\);/);
  assert.ok(response);
  assert.doesNotMatch(response[0], /identityNumber\s*:/);
  assert.match(route, /IDENTITY_BELONGS_TO_OTHER_CONTRACTOR/);
});

test('representative expiry is optional, expired entered dates still block issue, and no-residence exceptions keep a required reason', () => {
  assert.match(center, /انتهاء الإقامة \(اختياري\)/);
  assert.doesNotMatch(centerJs, /residenceExpiresAt\.required\s*=\s*!this\.checked/);
  assert.doesNotMatch(route, /!noResidenceException && !residenceExpiresAt/);
  assert.match(route, /else if \(representative\.residenceExpiresAt\)/);
  assert.match(route, /الإقامة منتهية أو لا تغطي تاريخ الزيارة/);
  assert.match(route, /noResidenceException && !exceptionReason/);
});

test('periodic visits do not ask for purpose or times in the direct and requester forms', () => {
  assert.match(route, /DEFAULT_VISIT_PURPOSE = "زيارة دورية لأنظمة المستشفى"/);
  assert.doesNotMatch(center + centerJs, /name="purpose"|id="f_purpose"|datetime-local/);
  assert.doesNotMatch(requestVisit, /id="f_purpose"|purpose:\s*document/);
  assert.match(requestVisit, /زيارة دورية لأنظمة المستشفى/);
  assert.match(requestVisit, /shared\.endsAt = null/);
});

test('center retries expired auth, opens through the authenticated viewer and QR can securely download the permit', () => {
  assert.match(center, /original-viewer\?/);
  assert.match(centerJs, /response\.status === 401/);
  assert.match(centerJs, /renewSession/);
  assert.match(centerJs, /clearCachedToken/);
  assert.match(center, /id="renew-session"/);
  assert.match(requireAuthSource, /AUTH_TOKEN_INVALID/);
  assert.doesNotMatch(requireAuthSource, /error: "Invalid token"/);
  assert.match(centerJs, /handleQrDeepLink/);
  assert.match(centerJs, /downloadPermitFromScan/);
  assert.match(centerJs, /v\.hasSignedPermit/);
  assert.match(centerJs, /NajranVisitPermit\.print\(v\.id\)/);
  assert.match(route, /hasSignedPermit: full \? !!row\.visit\.signedPermitFile : undefined/);
});

test('direct issue filters companies by system and falls back when no links exist', () => {
  assert.match(center, /id="direct-readiness"/);
  assert.match(centerJs, /renderDirectReadiness/);
  assert.match(centerJs, /اختر النظام أولًا/);
  assert.match(centerJs, /state\.data\.siteApprovals/);
  assert.match(centerJs, /state\.data\.representativeSystems/);
  assert.match(centerJs, /Object\.keys\(allowed\)\.length > 0/);
  assert.match(centerJs, /row\.isActive && \(!hasLinkedContractors \|\| !!allowed\[row\.id\]\)/);
  assert.match(centerJs, /متاحة للاستكمال/);
  assert.match(center, /بعد اختيار النظام تظهر الشركات المرتبطة به/);
  assert.match(centerJs, /أكمل اعتماد الموقع للشركة والنظام/);
});

test('session renewal and proactive keepalive preserve progress without leaving the center', () => {
  assert.match(centerJs, /UI_STATE_KEY/);
  assert.match(centerJs, /sessionStorage\.setItem\(UI_STATE_KEY/);
  assert.match(centerJs, /saveUiState\(\);\s*clearCachedToken\(\)/);
  assert.match(centerJs, /SESSION_KEEPALIVE_MS = 45 \* 1000/);
  assert.match(centerJs, /setInterval\(keepSessionAlive, SESSION_KEEPALIVE_MS\)/);
  assert.match(centerJs, /window\.addEventListener\('focus', keepSessionAlive\)/);
  assert.match(centerJs, /document\.addEventListener\('visibilitychange'/);
  assert.match(centerJs, /retried \? await refreshSessionToken\(\) : await freshToken\(false\)/);
  assert.match(centerJs, /restoreDirectSelection\(saved\.direct\)/);
  assert.match(centerJs, /activateTab\(saved\.tab\)/);
  assert.match(center, /تحديث آمن/);
  assert.doesNotMatch(centerJs, /location\.(?:href|replace)[^\n]*sign-in/);
  assert.match(center, /#najran-revision-mode-badge\{display:none!important\}/);
});

test('direct issue can select an existing company representative and add an idempotent system link', () => {
  const linkRoute = route.match(/router\.post\("\/management\/direct-representative-link"[\s\S]*?\n}\);/);
  assert.ok(linkRoute);
  assert.match(linkRoute[0], /visitRepresentativesTable\.contractorId/);
  assert.match(linkRoute[0], /visitRepresentativeSystemsTable/);
  assert.match(linkRoute[0], /onConflictDoUpdate/);
  assert.match(linkRoute[0], /await audit/);
  assert.doesNotMatch(linkRoute[0], /identityNumber:\s*representative\.identityNumber/);
  assert.match(centerJs, /اختيار مندوب مسجل أو إضافة جديد/);
  assert.match(centerJs, /\/management\/direct-representative-link/);
  assert.match(centerJs, /لن تُلغى روابط المندوب السابقة/);
});

test('legacy Word representatives import previews masked data then confirms company, representative and system links atomically', () => {
  assert.match(route, /legacy-representatives\/preview/);
  assert.match(route, /legacy-representatives\/confirm/);
  assert.match(route, /word\/document\.xml/);
  assert.match(route, /validateZipEntries\(entries\)/);
  assert.match(route, /identityMasked: maskIdentity\(record\.identityNumber\)/);
  assert.match(route, /mobileMasked:/);
  const confirmBlock = route.match(/router\.post\("\/management\/legacy-representatives\/confirm"[\s\S]*?\n}\);/);
  assert.ok(confirmBlock);
  assert.match(confirmBlock[0], /db\.transaction/);
  assert.match(confirmBlock[0], /upsertRepresentative/);
  assert.match(confirmBlock[0], /visitRepresentativeSystemsTable/);
  assert.match(confirmBlock[0], /await audit/);
  assert.match(center, /id="legacy-representatives-form"/);
  assert.match(center, /multiple required/);
  assert.match(center, /id="direct-saved-representative"/);
  assert.match(centerJs, /applySavedRepresentative/);
  assert.match(centerJs, /identityMasked/);
});

test('archive supports all requested filters and pagination', () => {
  for (const field of ['permitNumber', 'visitorName', 'company', 'system', 'site', 'status', 'from', 'to']) assert.match(route, new RegExp(`req\\.query\\.${field}`));
  assert.match(route, /\.limit\(limit\)\.offset\(\(page - 1\) \* limit\)/);
  assert.match(center, /id="archive-filter"/);
  assert.match(centerJs, /management\/archive/);
});

test('printing reuses one shared permit layout, includes QR and verification text, and excludes identity images', () => {
  assert.match(printJs, /إعتماد موافقة زيارة مقاولي الباطن/);
  assert.match(printJs, /تم التحقق من بيانات الهوية\/الإقامة إلكترونيًا/);
  assert.match(printJs, /توافق وحدة الصيانة العامة بتجمع نجران الصحي/);
  assert.match(printJs, /مشرف وحدة الصيانة العامة/);
  assert.match(printJs, /م\. محمد عباس المكرمي/);
  assert.match(printJs, /qrDataUrl/);
  assert.match(printJs, /data-role="permit-stamp"/);
  assert.match(printJs, /data-role="permit-qr"/);
  assert.match(printJs, /مسودة/);
  assert.doesNotMatch(printJs, /\['الموقع',/);
  assert.doesNotMatch(printJs, /\['وقت بداية الزيارة',/);
  assert.doesNotMatch(printJs, /\['وقت نهاية الزيارة',/);
  assert.doesNotMatch(printJs, /\['الغرض من الزيارة',/);
  assert.doesNotMatch(printJs, /repIdPhoto|صورة الهوية|صورة الإقامة/);
  assert.doesNotMatch(center + centerJs, /repIdPhoto|signedPermitFile/);
});

test('electronic stamp and signature settings validate real image bytes and remain outside listing APIs', () => {
  assert.match(route, /normalizedPrintAsset/);
  assert.match(route, /MAX_VISIT_PRINT_ASSET_BYTES/);
  assert.match(route, /detectVisitFile\(buffer\)/);
  assert.match(route, /PRINT_ASSET_MAGIC/);
  const bootstrapBlock = route.match(/router\.get\("\/management\/bootstrap"[\s\S]*?\n}\);/);
  assert.ok(bootstrapBlock);
  assert.doesNotMatch(bootstrapBlock[0], /visit_stamp|visit_signature/);
  assert.match(center, /id="stamp-preview"/);
  assert.match(center, /id="signature-preview"/);
});

test('camera scanner supports BarcodeDetector, jsQR fallback, camera switching and manual permit search', () => {
  assert.match(centerJs, /BarcodeDetector/);
  assert.match(centerJs, /window\.jsQR/);
  assert.match(centerJs, /enumerateDevices/);
  assert.match(centerJs, /facingMode: \{ ideal: 'environment' \}/);
  assert.match(centerJs, /getTracks\(\)\.forEach/);
  assert.match(centerJs, /\/qr\/manual\?serialNumber=/);
  assert.match(center, /id="camera-select"/);
  assert.match(center, /id="camera-rescan"/);
});

test('new visit browser scripts are syntactically valid and do not use native dialogs', () => {
  new vm.Script(centerJs, { filename: 'cluster-subcontractor-visits.js' });
  new vm.Script(printJs, { filename: 'visit-permit-print.js' });
  for (const source of [center, centerJs, printJs]) assert.doesNotMatch(source, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
});
