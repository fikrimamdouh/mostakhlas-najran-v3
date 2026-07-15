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
const rosterXlsxSource = read('artifacts/api-server/src/lib/visit-roster-xlsx.ts');
const middleware = read('artifacts/api-server/src/middleware/requireClusterVisitManagement.ts');
const requireAuthSource = read('artifacts/api-server/src/middleware/requireAuth.ts');
const schema = read('lib/db/src/schema/index.ts');
const center = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.html');
const centerJs = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.js');
const printJs = read('artifacts/mustaklassat/public/original/visit-permit-print.js');
const publicVerify = read('artifacts/mustaklassat/public/visit-permit-verify.html');
const facilityPage = read('artifacts/mustaklassat/public/original/facility-visit-approval.html');
const facilityJs = read('artifacts/mustaklassat/public/original/facility-visit-approval.js');
const modulesSource = read('artifacts/mustaklassat/src/lib/modules.ts');
const webAppSource = read('artifacts/mustaklassat/src/App.tsx');
const originalViewerSource = read('artifacts/mustaklassat/src/pages/OriginalViewer.tsx');
const requestVisit = read('artifacts/mustaklassat/public/original/request-visit.html');
const authCheck = read('artifacts/mustaklassat/public/original/auth-check.js');
const require = createRequire(import.meta.url);
const compiledSecurity = ts.transpileModule(security, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const securityModule = { exports: {} };
new Function('require', 'module', 'exports', compiledSecurity)(require, securityModule, securityModule.exports);
const visitSecurity = securityModule.exports;
const compiledRosterXlsx = ts.transpileModule(rosterXlsxSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const rosterXlsxModule = { exports: {} };
new Function('require', 'module', 'exports', compiledRosterXlsx)(
  (specifier) => specifier === './visit-security.js' ? visitSecurity : require(specifier),
  rosterXlsxModule,
  rosterXlsxModule.exports,
);
const { parseRepresentativeRosterXlsx } = rosterXlsxModule.exports;

function representativeRosterWorkbook() {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'));
  zip.addFile('xl/workbook.xml', Buffer.from('<?xml version="1.0"?><x:workbook xmlns:x="urn:test" xmlns:r="urn:rels"><x:sheets><x:sheet name="المندوبون" sheetId="3" r:id="roster"/></x:sheets></x:workbook>'));
  zip.addFile('xl/_rels/workbook.xml.rels', Buffer.from('<?xml version="1.0"?><Relationships><Relationship Id="roster" Target="/xl/worksheets/sheet3.xml"/></Relationships>'));
  const headers = ['اسم المندوب', 'رقم الهوية / الإقامة', 'رقم الجوال', 'النظام', 'مقاول الباطن'];
  const values = ['مندوب تجريبي', String(2).padEnd(10, '0'), '05' + '0'.repeat(8), 'نظام تجريبي', 'شركة تجريبية للمقاولات'];
  const row = (number, cells) => '<x:row r="' + number + '">' + cells.map((value, index) => '<x:c r="' + String.fromCharCode(65 + index) + number + '" t="inlineStr"><x:is><x:t>' + value + '</x:t></x:is></x:c>').join('') + '</x:row>';
  zip.addFile('xl/worksheets/sheet3.xml', Buffer.from('<?xml version="1.0"?><x:worksheet xmlns:x="urn:test"><x:sheetData>' + row(1, headers) + row(2, values) + '</x:sheetData></x:worksheet>'));
  return zip.toBuffer();
}

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
  assert.ok(visitSecurity.validateVisitWindow('2026-07-14', null).startsAt);
  const storedDate = new Date('2026-07-14T12:00:00.000Z');
  assert.equal(visitSecurity.validateVisitWindow(storedDate, null).startsAt.toISOString(), storedDate.toISOString());
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
  assert.match(schema, /archivedAt: timestamp\("archived_at"\)/);
  assert.match(route, /router\.patch\("\/:id\/archive"[\s\S]*status: "cancelled"[\s\S]*archivedAt: now/);
  assert.match(route, /إلغاء زيارة تجريبية وإخفاؤها من العرض دون حذف/);
  assert.match(route, /router\.patch\("\/:id\/archive\/restore"/);
  assert.match(center, /المحذوفة من العرض/);
  assert.match(centerJs, /openArchiveVisit/);
});

test('permanent test-visit deletion is two-stage, transactionally complete and explicitly confirmed', () => {
  const block = route.match(/router\.delete\("\/:id\/permanent"[\s\S]*?\n}\);/);
  assert.ok(block);
  assert.match(block[0], /requireClusterVisitManagement/);
  assert.match(block[0], /if \(!visit\.archivedAt\)/);
  assert.match(block[0], /DELETE:\$\{visit\.serialNumber/);
  assert.match(block[0], /DELETE_HAS_REISSUE/);
  for (const table of ['visitDocumentContentsTable', 'visitDocumentsTable', 'visitFacilityApprovalsTable', 'visitPermitTokensTable', 'visitRequestMetadataTable', 'visitRequestsTable']) {
    assert.match(block[0], new RegExp(`tx\\.delete\\(${table}\\)`));
  }
  assert.match(block[0], /tx\.insert\(auditLogTable\)/);
  assert.match(block[0], /حذف نهائي لزيارة تجريبية بعد تأكيد رقم التصريح/);
  assert.match(centerJs, /openPermanentDelete/);
  assert.match(centerJs, /DELETE:'\+\(v\.serialNumber/);
  assert.match(centerJs, /حذف نهائي لا يمكن التراجع عنه/);
});

test('permit numbers use one atomic database upsert and have a uniqueness backstop', () => {
  assert.match(route, /onConflictDoUpdate\([\s\S]*visitNumberSequencesTable\.lastValue} \+ 1/);
  assert.match(route, /returning\(\{ lastValue: visitNumberSequencesTable\.lastValue \}\)/);
  assert.match(schema, /visit_number_sequences[\s\S]*scopeKey: text\("scope_key"\)\.notNull\(\)\.unique\(\)/);
  assert.match(schema, /visit_requests_atomic_serial_unique/);
  assert.match(schema, /visit_number_sequences/);
  assert.match(route, /NHC-NJ-VIS-\$\{year\}-\$\{month\}-\$\{String\(sequence\.lastValue\)\.padStart\(5, "0"\)\}/);
  assert.match(route, /scopeKey = `\$\{year\}-\$\{month\}:visits`/);
  assert.match(schema, /\^NHC-NJ-VIS-\[0-9\]\{4\}-\[0-9\]\{2\}-\[0-9\]\{5\}\$/);
  assert.match(route, /getMonth\(\) \+ 1/);
});

test('reissue creates a new visit, metadata and QR without updating the original visit', () => {
  const block = route.match(/router\.post\("\/:id\/reissue"[\s\S]*?\n}\);/);
  assert.ok(block, 'reissue route must exist');
  assert.match(block[0], /insert\(visitRequestsTable\)/);
  assert.match(block[0], /reissuedFromVisitId: originalId/);
  assert.match(block[0], /insert\(visitRequestMetadataTable\)/);
  assert.match(block[0], /snapshotJson: original\.metadata\.snapshotJson/);
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

test('representative identity documents are listed, previewed securely and kept out of public QR data', () => {
  const catalog = route.match(/router\.get\("\/catalog"[\s\S]*?\n}\);/);
  assert.ok(catalog);
  assert.match(catalog[0], /representativeDocuments/);
  assert.match(catalog[0], /ownerType, "representative"/);
  assert.match(catalog[0], /status, "active"/);
  assert.match(catalog[0], /representativeDocuments: cluster \? representativeDocuments : \[\]/);
  assert.doesNotMatch(catalog[0], /visitDocumentContentsTable|sha256/);
  const bootstrapStart = route.indexOf('router.get("/management/bootstrap"');
  const bootstrapEnd = route.indexOf('router.post("/management/systems"', bootstrapStart);
  const bootstrap = route.slice(bootstrapStart, bootstrapEnd);
  assert.match(bootstrap, /representativeDocuments/);
  assert.match(bootstrap, /ownerType, "representative"/);
  assert.match(bootstrap, /status, "active"/);
  assert.doesNotMatch(bootstrap, /visitDocumentContentsTable|sha256/);
  const contentRoute = route.match(/router\.get\("\/management\/documents\/:id\/content"[\s\S]*?\n}\);/);
  assert.ok(contentRoute);
  assert.match(contentRoute[0], /requireClusterVisitManagement/);
  assert.match(contentRoute[0], /req\.query\.preview === "1"/);
  assert.match(contentRoute[0], /معاينة وثيقة زيارة محمية/);
  assert.match(contentRoute[0], /preview \? "inline" : "attachment"/);
  assert.match(contentRoute[0], /Cache-Control", "private, no-store, max-age=0/);
  assert.match(route, /iqama_front/);
  assert.match(route, /iqama_back/);
  assert.match(route, /iqama_pdf/);
  assert.match(route, /IDENTITY_IMAGE_TOO_LARGE/);
  assert.match(center, /دليل المندوبين/);
  assert.match(center, /ملف موحد للمندوب والشركة والأنظمة والوثائق/);
  assert.match(centerJs, /data-preview-doc/);
  assert.match(centerJs, /previewDocument/);
  assert.match(centerJs, /fetchDocumentBlob/);
  assert.match(centerJs, /تم حفظ الوثيقة مع الاحتفاظ بتاريخ البدائل[\s\S]*await loadBootstrap\(\)/);
  assert.match(centerJs, /تم تسجيل عملية المعاينة في سجل التدقيق/);
  assert.doesNotMatch(publicVerify, /iqama_front|iqama_back|iqama_pdf|representativeDocuments/);
});

test('XLSX representative roster is parsed, masked, confirmed and applied transactionally', () => {
  const parsed = parseRepresentativeRosterXlsx(representativeRosterWorkbook());
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].fullName, 'مندوب تجريبي');
  assert.equal(parsed[0].identityNumber, String(2).padEnd(10, '0'));
  assert.equal(parsed[0].mobile, '05' + '0'.repeat(8));
  assert.match(rosterXlsxSource, /validateZipEntries\(zip\.getEntries\(\)\)/);
  assert.match(rosterXlsxSource, /ROSTER_SHEET_NOT_FOUND/);
  assert.match(rosterXlsxSource, /ROSTER_HEADERS_NOT_FOUND/);
  assert.match(rosterXlsxSource, /\^\\d\{10\}\$/);
  assert.match(rosterXlsxSource, /ROSTER_IDENTITY_CONFLICT/);

  const previewStart = route.indexOf('router.post("/management/representative-roster/preview"');
  const confirmStart = route.indexOf('router.post("/management/representative-roster/confirm"');
  const confirmEnd = route.indexOf('router.post("/management/direct-representative"', confirmStart);
  const preview = route.slice(previewStart, confirmStart);
  const confirm = route.slice(confirmStart, confirmEnd);
  assert.match(preview, /requireClusterVisitManagement/);
  assert.match(preview, /identityMasked: maskIdentity/);
  assert.match(preview, /mobileMasked/);
  assert.match(preview, /confirmationText: `REPLACE:/);
  assert.doesNotMatch(preview.match(/return res\.json\(\{[\s\S]*$/)?.[0] || '', /identityNumber: record\.identityNumber|mobile: record\.mobile/);
  assert.match(confirm, /db\.transaction/);
  assert.match(confirm, /expectedConfirmation = `REPLACE:/);
  assert.match(confirm, /update\(visitRepresentativeSystemsTable\)[\s\S]*isActive: false/);
  assert.match(confirm, /approvedIdentities[\s\S]*isActive: false/);
  assert.match(confirm, /onConflictDoUpdate\([\s\S]*contractorId: contractor\.id/);
  assert.match(confirm, /insert\(visitRepresentativeSystemsTable\)/);
  assert.match(confirm, /استبدال قائمة المندوبين المعتمدة من Excel/);
  assert.match(center, /representative-roster-form/);
  assert.match(centerJs, /representative-roster\/preview/);
  assert.match(centerJs, /representative-roster\/confirm/);
  assert.match(centerJs, /اكتب النص التالي كاملًا للتأكيد/);
  assert.match(centerJs, /var rows = d\.representatives\.filter/);
  assert.doesNotMatch(rosterXlsxSource + preview + confirm, /بيانات_زيارات_مقاولي_الباطن_المستخرجة/);
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
  assert.match(qrPayload[1], /verifyUrl/);
  const verifyUrl = route.match(/const verifyUrl = ([^;]+);/);
  assert.ok(verifyUrl);
  assert.match(verifyUrl[1], /visit-permit-verify\.html#/);
  assert.doesNotMatch(verifyUrl[1], /repId|repName|identity|mobile|visitId|download=1/);
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

test('direct issue uses the maintenance-contractor site catalogue and one validated visit date', () => {
  assert.match(route, /key: "بيت_العرب"/);
  assert.match(route, /key: "سراكو"/);
  assert.match(route, /"تجمع نجران الصحي"/);
  assert.match(route, /الموقع المحدد لا يتبع مقاول الصيانة المختار/);
  assert.match(route, /endsAtProvided: !!window\.endsAt/);
  assert.match(centerJs, /body\.startsAt = startDay/);
  assert.match(centerJs, /body\.endsAt = null/);
  assert.match(centerJs, /اختر تاريخ الزيارة من حقل التاريخ/);
  assert.doesNotMatch(center + centerJs, /تاريخ نهاية الزيارة|تاريخ النهاية \(اختياري\)|name="endsAt"|elements\.endsAt/);
});

test('direct issue allows site approval and qualification to be completed later', () => {
  for (const id of ['direct-add-contractor', 'direct-complete-approval', 'direct-add-representative']) assert.match(center, new RegExp(`id="${id}"`));
  assert.match(center, /التأهيل فيمكن تأجيله لهذه المرحلة/);
  assert.match(centerJs, /\/management\/direct-setup/);
  assert.match(centerJs, /\/management\/direct-representative/);
  assert.match(centerJs, /body\.qualificationId = qualification \? qualification\.id : null/);
  assert.match(centerJs, /body\.siteApprovalId = approval \? approval\.id : null/);
  assert.match(centerJs, /approvedPersonnel/);
  const setup = route.match(/router\.post\("\/management\/direct-setup"[\s\S]*?\n}\);/);
  assert.ok(setup);
  assert.match(setup[0], /db\.transaction/);
  assert.match(setup[0], /includeQualification/);
  assert.match(setup[0], /if \(includeQualification\)/);
  assert.match(setup[0], /visitSiteApprovalsTable/);
  assert.match(setup[0], /await audit/);
  assert.match(route, /if \(!systemId \|\| !contractorId \|\| !representativeId\) return res\.status\(400\)/);
  assert.match(route, /approveVisit\(tx, visit\.id, req\.currentUser, \{ qualificationOptional: true, siteApprovalOptional: true \}\)/);
  assert.match(route, /qualificationDeferred: !qualificationId/);
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

test('representative expiry is absent from current APIs and forms while no-residence exceptions keep a required reason', () => {
  assert.doesNotMatch(center + centerJs + route, /residenceExpiresAt|انتهاء الإقامة|تاريخ الانتهاء|الإقامة منتهية/);
  assert.match(route, /noResidenceException && !exceptionReason/);
  assert.match(route, /if \(representative\.noResidenceException\)/);
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
  assert.match(center, /اعتماد الموقع مطلوب للإصدار/);
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
  assert.match(centerJs, /NAJRAN_TOKEN_REQUEST/);
  assert.match(centerJs, /tokenIsUsable/);
  assert.match(centerJs, /force \? 15000 : 2000/);
  assert.match(centerJs, /cacheSessionToken/);
  assert.match(centerJs, /loadBootstrap\(\{ throwOnError: true \}\)/);
  assert.match(originalViewerSource, /NAJRAN_TOKEN_RESPONSE/);
  assert.match(originalViewerSource, /session as any\)\?\.reload/);
  assert.match(originalViewerSource, /najranGetFreshToken === getFreshViewerToken/);
  assert.match(webAppSource, /const getFreshSessionToken = async/);
  assert.match(webAppSource, /getToken\(force \? \(\{ skipCache: true \}/);
  assert.match(webAppSource, /najranGetFreshToken === getFreshSessionToken/);
  assert.match(webAppSource, /AUTH_RETURN_PATH_KEY/);
  assert.match(webAppSource, /fallbackRedirectUrl=\{fallbackRedirectUrl\}/);
  assert.match(webAppSource, /component=\{OriginalViewerRoute\}/);
  assert.doesNotMatch(webAppSource, /path="\/original-viewer"[^\n]*<Show when="signed-in"/);
  assert.match(center, /تحديث آمن/);
  assert.doesNotMatch(centerJs, /location\.(?:href|replace)[^\n]*sign-in/);
  assert.match(center, /#najran-revision-mode-badge\{display:none!important\}/);
});

test('sites and subcontractor systems keep long names readable with consistent responsive actions', () => {
  assert.match(center, /class="panel sites-panel" data-panel="sites"/);
  assert.match(center, /\.catalog-row\{/);
  assert.match(center, /\.catalog-copy\{[^}]*overflow-wrap:anywhere/);
  assert.match(center, /\.catalog-actions \.btn\{[^}]*white-space:nowrap/);
  assert.match(center, /@media\(max-width:560px\)[^{]*\{\.catalog-actions\{display:grid/);
  assert.match(centerJs, /class="alert-row catalog-row"/);
  assert.match(centerJs, /class="catalog-meta-item"><b>النظام:/);
  assert.match(centerJs, /class="catalog-meta-item"><b>الشركة:/);
  assert.match(centerJs, /class="actions catalog-actions"/);
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

test('direct issue accepts one to four representatives from the same company and system and snapshots all of them', () => {
  const directIssue = route.match(/router\.post\("\/management\/direct-issue"[\s\S]*?\n}\);/);
  assert.ok(directIssue);
  assert.match(directIssue[0], /representativeIds/);
  assert.match(directIssue[0], /representativeIds\.length > 4/);
  assert.match(directIssue[0], /row\.contractorId !== contractorId/);
  assert.match(directIssue[0], /linkedRepresentativeIds/);
  assert.match(directIssue[0], /representativeSnapshot/);
  assert.match(directIssue[0], /snapshotJson: JSON\.stringify\(\{ schemaVersion: 2, representatives: representativeSnapshot \}\)/);
  assert.match(center, /id="direct-representative-options"/);
  assert.match(centerJs, /selectedDirectRepresentativeIds/);
  assert.match(centerJs, /body\.representativeIds = selectedDirectRepresentativeIds\(\)/);
  assert.match(centerJs, /يمكن اختيار أربعة مناديب كحد أقصى/);
});

test('direct issue serializes identical submissions and returns the existing permit instead of creating another', () => {
  const directIssue = route.match(/router\.post\("\/management\/direct-issue"[\s\S]*?\n}\);/);
  assert.ok(directIssue);
  assert.match(directIssue[0], /directIssueDedupeKey/);
  assert.match(directIssue[0], /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(directIssue[0], /representativeIdsFromMetadata/);
  assert.match(directIssue[0], /ids\.length === sortedRepresentativeIds\.length/);
  assert.match(directIssue[0], /code: "VISIT_ALREADY_EXISTS"/);
  assert.match(directIssue[0], /لم يتم إنشاء تصريح جديد/);
  assert.match(centerJs, /result\.duplicate/);
  assert.match(centerJs, /تم إصدار تصريح سابق بنفس البيانات/);
});

test('unused companies, qualifications and representatives can be deleted safely while used records require disable', () => {
  for (const entity of ['contractors', 'qualifications', 'representatives']) {
    const block = route.match(new RegExp(`router\\.delete\\("/management/${entity}/:id"[\\s\\S]*?\\n}\\);`));
    assert.ok(block, `safe delete route for ${entity}`);
    assert.match(block[0], /requireClusterVisitManagement/);
    assert.match(block[0], /status\(409\)/);
    assert.match(block[0], /استخدم التعطيل/);
    assert.match(block[0], /await audit/);
  }
  assert.match(route, /secondarySnapshotReference/);
  assert.match(centerJs, /data-delete-contractor/);
  assert.match(centerJs, /data-delete-qualification/);
  assert.match(centerJs, /data-delete-rep/);
  assert.match(centerJs, /openSafeDelete/);
  assert.doesNotMatch(centerJs, /\bconfirm\s*\(/);
});

test('systems and site approvals support modal editing and safe deletion', () => {
  for (const entity of ['systems', 'site-approvals']) {
    const block = route.match(new RegExp(`router\\.delete\\("/management/${entity}/:id"[\\s\\S]*?\\n}\\);`));
    assert.ok(block, `safe delete route for ${entity}`);
    assert.match(block[0], /requireClusterVisitManagement/);
    assert.match(block[0], /status\(409\)/);
    assert.match(block[0], /استخدم التعطيل/);
    assert.match(block[0], /await audit/);
  }
  assert.match(centerJs, /data-edit-system/);
  assert.match(centerJs, /data-delete-system/);
  assert.match(centerJs, /openEditSystem/);
  assert.match(centerJs, /data-edit-approval/);
  assert.match(centerJs, /data-delete-approval/);
  assert.match(centerJs, /openEditSiteApproval/);
  assert.match(route, /APPROVED_CATALOG_SEEDED_SETTING/);
});

test('representative screen can create and immediately select a missing company', () => {
  assert.match(center, /id="rep-add-contractor"/);
  assert.match(center, /id="rep-system-options"/);
  assert.match(center, /حفظ الشركة والمندوب وربط الأنظمة/);
  assert.match(centerJs, /pendingRepresentativeContractor/);
  assert.match(centerJs, /body\.newContractor = state\.pendingRepresentativeContractor/);
  assert.match(centerJs, /body\.systemIds = Array\.from/);
  const representativeRoute = route.match(/router\.post\("\/management\/representatives"[\s\S]*?\n}\);/);
  assert.ok(representativeRoute);
  assert.match(representativeRoute[0], /db\.transaction/);
  assert.match(representativeRoute[0], /visitContractorsTable/);
  assert.match(representativeRoute[0], /upsertRepresentative/);
  assert.match(representativeRoute[0], /visitRepresentativeSystemsTable/);
  assert.match(representativeRoute[0], /onConflictDoUpdate/);
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
  assert.match(center, /id="direct-representative-search"/);
  assert.match(centerJs, /refreshSavedRepresentativeOptions/);
  assert.match(centerJs, /direct-representative-search'\)\.addEventListener\('input'/);
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
  assert.match(printJs, /مدير وحدة الصيانة العامة بتجمع نجران الصحي/);
  assert.match(printJs, /م\. محمد عباس المكرمي/);
  assert.match(printJs, /qrDataUrl/);
  assert.match(printJs, /data-role="permit-stamp"/);
  assert.match(printJs, /data-role="permit-qr"/);
  assert.match(printJs, /مسودة/);
  assert.match(printJs, /\['الموقع',/);
  assert.match(printJs, /v\.representatives/);
  assert.match(printJs, /representative\.identityNumber/);
  assert.match(printJs, /representative\.mobile/);
  assert.match(printJs, /اسم المندوب/);
  assert.match(printJs, /تحقق عام من التصريح/);
  assert.match(printJs, /يرجى إبراز بطاقة تأهيل الفريق الفني ونموذج اعتماد موافقة زيارة مقاولي الباطن للمسؤول بالمنشأة/);
  assert.match(printJs, /data-role="permit-stamp"[\s\S]*data-role="permit-qr"/);
  assert.match(printJs, /visit-default-stamp\.png/);
  assert.match(printJs, /visit-default-signature\.png/);
  assert.match(printJs, /waitForImages/);
  assert.doesNotMatch(printJs, /\['وقت بداية الزيارة',/);
  assert.doesNotMatch(printJs, /\['وقت نهاية الزيارة',/);
  assert.doesNotMatch(printJs, /\['الغرض من الزيارة',/);
  assert.doesNotMatch(printJs, /repIdPhoto|صورة الهوية|صورة الإقامة/);
  assert.doesNotMatch(center + centerJs, /repIdPhoto|signedPermitFile/);
});

test('permit copy is editable, persisted centrally and escaped before print rendering', () => {
  for (const field of ['organizationText', 'permitTitle', 'verificationText', 'approvalText', 'closingText', 'qrLabel', 'footerNote']) {
    assert.match(center, new RegExp(`name="${field}"`));
    assert.match(route, new RegExp(`field: "${field}"`));
    assert.match(centerJs, new RegExp(`DEFAULT_VISIT_PRINT_TEXTS[\\s\\S]*${field}`));
  }
  for (const key of ['visit_permit_organization_text', 'visit_permit_title', 'visit_permit_verification_text', 'visit_permit_approval_text', 'visit_permit_closing_text', 'visit_permit_qr_label', 'visit_permit_footer_note']) {
    assert.match(route, new RegExp(key));
  }
  assert.match(route, /getVisitPrintTexts\(\)/);
  assert.match(route, /VISIT_PRINT_TEXT_FIELDS[\s\S]*setSetting\(definition\.key/);
  assert.match(route, /settings:[\s\S]*\.\.\.printTexts/);
  assert.match(centerJs, /printTextBody/);
  assert.match(centerJs, /reset-print-texts/);
  assert.match(printJs, /function textSetting/);
  assert.match(printJs, /function multiline[\s\S]*esc\(value\)/);
  assert.match(printJs, /settings, 'approvalText'/);
  assert.match(printJs, /settings, 'footerNote'/);
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
  assert.equal(fs.existsSync(path.join(root, 'artifacts/mustaklassat/public/original/visit-default-stamp.png')), true);
  assert.equal(fs.existsSync(path.join(root, 'artifacts/mustaklassat/public/original/visit-default-signature.png')), true);
  assert.match(route, /DEFAULT_VISIT_SIGNER_TITLE = "مدير وحدة الصيانة العامة بتجمع نجران الصحي"/);
  assert.match(route, /title === LEGACY_VISIT_SIGNER_TITLE/);
});

test('representative page uses one responsive directory with search, clear metadata and protected document actions', () => {
  assert.equal((center.match(/data-panel="representatives"/g) || []).length, 1);
  for (const selector of ['representatives-layout', 'representative-form-card', 'representative-directory-card', 'rep-list-search', 'reps-list-count', 'representative-imports']) {
    assert.match(center, new RegExp(selector));
  }
  assert.match(centerJs, /function renderRepresentativesList/);
  assert.match(centerJs, /representative-card/);
  assert.match(centerJs, /representative-meta/);
  assert.match(centerJs, /document-list/);
  assert.match(centerJs, /rep-list-search'\)\.addEventListener\('input'/);
  assert.match(centerJs, /data-preview-doc/);
  assert.match(centerJs, /data-download-doc/);
  assert.match(center, /تظهر الهوية والجوال كاملين هنا للمطابقة المباشرة فقط/);
  assert.match(centerJs, /function representativeIdentity[\s\S]*identityNumber/);
  assert.match(centerJs, /function representativeMobile[\s\S]*representative\.mobile/);
});

test('camera scanner supports BarcodeDetector, jsQR fallback, camera switching and manual permit search', () => {
  assert.match(centerJs, /BarcodeDetector/);
  assert.match(centerJs, /window\.jsQR/);
  assert.match(centerJs, /enumerateDevices/);
  assert.match(centerJs, /facingMode: \{ ideal: 'environment' \}/);
  assert.match(centerJs, /getTracks\(\)\.forEach/);
  assert.match(centerJs, /\/qr\/manual\?serialNumber=/);
  assert.match(centerJs, /visit-permit-verify\.html/);
  assert.match(centerJs, /decodeURIComponent\(url\.hash\.slice\(1\)\)/);
  assert.match(center, /QR يفتح صفحة تحقق عامة مختصرة/);
  assert.match(center, /id="camera-select"/);
  assert.match(center, /id="camera-rescan"/);
});

test('public QR verification is rate limited, current, and exposes only the approved summary fields', () => {
  const publicRoute = route.match(/router\.get\("\/qr\/public"[\s\S]*?\n}\);/);
  assert.ok(publicRoute);
  assert.doesNotMatch(publicRoute[0], /requireAuth|requireApproved|requireClusterVisitManagement/);
  assert.match(publicRoute[0], /assertScanRate/);
  assert.match(publicRoute[0], /verifyToken/);
  for (const field of ['serialNumber', 'status', 'visitorName', 'representatives', 'company', 'system', 'site', 'visitDate', 'startsAt', 'endsAt']) assert.match(publicRoute[0], new RegExp(field));
  assert.doesNotMatch(publicRoute[0], /repId|identityNumber|mobile|documentsVerified|exceptionReason|cancellationReason/);
  assert.match(publicVerify, /\/api\/visits\/qr\/public\?token=/);
  assert.match(publicVerify, /location\.hash/);
  assert.match(publicVerify, /credentials:'omit'/);
  assert.doesNotMatch(publicVerify, /repId|identityNumber|mobileMasked|documentsVerified|exceptionReason/);
});

test('full identity and mobile are available only inside authorized management and protected permit flows', () => {
  const bootstrapBlock = route.match(/router\.get\("\/management\/bootstrap"[\s\S]*?\n}\);/);
  assert.ok(bootstrapBlock);
  assert.match(bootstrapBlock[0], /requireClusterVisitManagement/);
  assert.match(bootstrapBlock[0], /identityNumber,/);
  assert.match(bootstrapBlock[0], /mobile: mobile \|\| ""/);
  assert.match(bootstrapBlock[0], /identityMasked: maskIdentity\(identityNumber\)/);
  const permitBlock = route.match(/router\.get\("\/:id\/permit"[\s\S]*?\n}\);/);
  assert.ok(permitBlock);
  assert.match(permitBlock[0], /permitRepresentatives/);
  assert.match(route, /const representatives = full \? permitRepresentatives/);
  assert.match(centerJs, /representative\.identityNumber/);
  assert.match(centerJs, /representative\.mobile/);
});

test('facility approval is database-permission-only, site-scoped and legacy-compatible', () => {
  assert.match(schema, /visit_facility_approvals/);
  assert.match(schema, /visitId: integer\("visit_id"\)\.notNull\(\)\.references\(\(\) => visitRequestsTable\.id\)\.unique\(\)/);
  assert.match(schema, /status: text\("status", \{ enum: \["pending", "approved", "rejected"\] \}\)/);
  assert.match(route, /FACILITY_VISIT_APPROVAL_MODULE = "facility_visit_approval"/);
  const permission = route.match(/function hasFacilityVisitApproval[\s\S]*?\n}/);
  assert.ok(permission);
  assert.match(permission[0], /allowedModules/);
  assert.doesNotMatch(permission[0], /\.role|\.email|admin|supervisor/);
  assert.match(route, /function sameFacilitySite[\s\S]*user\?\.hospital[\s\S]*visit\?\.siteLocation/);
  assert.match(route, /router\.get\("\/facility\/visits"[\s\S]*leftJoin\(visitFacilityApprovalsTable/);
  assert.match(route, /approval\?\.status \|\| "pending"/);
  assert.match(route, /router\.get\("\/facility\/visits\/:id"[\s\S]*sameFacilitySite/);
  assert.match(route, /router\.patch\("\/facility\/visits\/:id\/decision"[\s\S]*status === "rejected" && !notes/);
});

test('facility decisions and proof files are protected, audited and visible to the center', () => {
  assert.match(route, /اعتماد زيارة من إدارة المنشأة/);
  assert.match(route, /رفض زيارة من إدارة المنشأة/);
  assert.match(route, /router\.post\("\/facility\/visits\/:id\/attachment"[\s\S]*storeDocument\(req, "visit", id, "facility_approval_proof"/);
  assert.match(route, /router\.get\("\/facility\/visits\/:id\/attachments\/:documentId\/content"[\s\S]*sameFacilitySite/);
  assert.match(route, /FILE_MAGIC_MISMATCH|FILE_MIME_MISMATCH/);
  assert.match(route, /facilityApproval: facilityApprovalSummary\(facilityRows\[0\]\)/);
  assert.match(route, /management\/archive[\s\S]*facilityApprovalSummary\(row\.facilityApproval\)/);
  assert.match(center, /اعتماد المنشأة/);
  assert.match(centerJs, /اعتمدتها المنشأة/);
});

test('facility approval page is an explicit database module with secure in-page decisions', () => {
  assert.match(modulesSource, /FACILITY_VISIT_APPROVAL_MODULE_KEY = "facility_visit_approval"/);
  assert.match(modulesSource, /facility-visit-approval\.html[\s\S]*explicitOnly: true/);
  assert.match(authCheck, /'facility-visit-approval\.html': 'facility_visit_approval'/);
  assert.match(facilityPage, /اعتماد زيارات المنشأة/);
  assert.match(facilityPage, /لا تظهر هنا إلا الزيارات المطابقة للموقع المرتبط بحسابك/);
  assert.match(facilityJs, /\/facility\/visits\/.*\/decision/);
  assert.match(facilityJs, /\/attachment/);
  assert.match(facilityJs, /سبب الرفض \(مطلوب\)/);
  assert.match(facilityJs, /identityNumber/);
  assert.doesNotMatch(facilityJs.match(/async function loadVisits[\s\S]*?\n  }/)[0], /identityNumber|repId/);
});

test('new visit browser scripts are syntactically valid and do not use native dialogs', () => {
  new vm.Script(centerJs, { filename: 'cluster-subcontractor-visits.js' });
  new vm.Script(printJs, { filename: 'visit-permit-print.js' });
  new vm.Script(facilityJs, { filename: 'facility-visit-approval.js' });
  new vm.Script(publicVerify.match(/<script>([\s\S]*?)<\/script>/)[1], { filename: 'visit-permit-verify.html' });
  for (const source of [center, centerJs, printJs, publicVerify, facilityPage, facilityJs]) assert.doesNotMatch(source, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
});
