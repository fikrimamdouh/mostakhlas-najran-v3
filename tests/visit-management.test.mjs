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
const schema = read('lib/db/src/schema/index.ts');
const center = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.html');
const centerJs = read('artifacts/mustaklassat/public/original/cluster-subcontractor-visits.js');
const printJs = read('artifacts/mustaklassat/public/original/visit-permit-print.js');
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
});

test('archive supports all requested filters and pagination', () => {
  for (const field of ['permitNumber', 'visitorName', 'company', 'system', 'site', 'status', 'from', 'to']) assert.match(route, new RegExp(`req\\.query\\.${field}`));
  assert.match(route, /\.limit\(limit\)\.offset\(\(page - 1\) \* limit\)/);
  assert.match(center, /id="archive-filter"/);
  assert.match(centerJs, /management\/archive/);
});

test('printing reuses one shared permit layout, includes QR and verification text, and excludes identity images', () => {
  assert.match(printJs, /موافقة زيارة مقاولي الباطن/);
  assert.match(printJs, /تم التحقق من بيانات الهوية\/الإقامة إلكترونيًا/);
  assert.match(printJs, /qrDataUrl/);
  assert.match(printJs, /مسودة/);
  assert.doesNotMatch(printJs, /repIdPhoto|صورة الهوية|صورة الإقامة/);
  assert.doesNotMatch(center + centerJs, /repIdPhoto|signedPermitFile/);
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
