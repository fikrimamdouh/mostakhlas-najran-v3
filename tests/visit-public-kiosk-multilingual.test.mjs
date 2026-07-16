import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routeIndex = read('artifacts/api-server/src/routes/index.ts');
const kioskRoute = read('artifacts/api-server/src/routes/visits-public-kiosk.ts');
const printLoader = read('artifacts/mustaklassat/public/original/visit-permit-print.js');
const layout = read('artifacts/mustaklassat/public/original/visit-permit-download-qr-layout.js');
const hospitalMode = read('artifacts/mustaklassat/public/original/request-visit-postponement-mode.js');
const centerKiosk = read('artifacts/mustaklassat/public/original/visit-center-public-kiosk.js');
const publicWrapper = read('artifacts/mustaklassat/public/visit-request-form.html');

function inlineScripts(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]).filter((source) => source.trim());
}

test('one public QR is mounted before the legacy site-specific route and requires no site selection', () => {
  assert.ok(routeIndex.indexOf('visitsPublicKioskRouter') < routeIndex.indexOf('router.use("/visits", visitsRouter)'));
  assert.match(kioskRoute, /requestUrl = `\$\{publicOrigin\(req\)\}\/visit-request-form\.html`/);
  assert.doesNotMatch(kioskRoute, /maintenanceContractorKey|req\.body\?\.siteName|جميع المواقع/);
  assert.match(centerKiosk, /باركود ثابت للطباعة والتعليق/);
  assert.doesNotMatch(centerKiosk, /جميع المواقع/);
});

test('printed poster and public form support Arabic, English, Urdu and Hindi with Najran Health Cluster branding', () => {
  for (const value of ['العربية', 'English', 'اردو', 'हिन्दी']) assert.match(publicWrapper, new RegExp(value));
  for (const value of ['Subcontractor Visit Request', 'ذیلی ٹھیکیدار وزٹ درخواست', 'उप-ठेकेदार विज़िट अनुरोध']) assert.match(centerKiosk + publicWrapper, new RegExp(value));
  assert.match(publicWrapper, /najran_health_cluster_logo\.png/);
  assert.match(publicWrapper, /تجمع نجران الصحي/);
  assert.match(publicWrapper, /steps:/);
  assert.doesNotMatch(publicWrapper, /admin-policy-card/);
});

test('hospital portal owns postponement mode while the public visitor form remains new-visit only', () => {
  assert.match(printLoader, /request-visit-postponement-mode\.js/);
  assert.match(hospitalMode, /اختر نوع الطلب/);
  assert.match(hospitalMode, /طلب زيارة جديدة/);
  assert.match(hospitalMode, /طلب تأجيل زيارة/);
  assert.match(hospitalMode, /سبب الموقع للتأجيل/);
  assert.match(hospitalMode, /postponement-request/);
  assert.doesNotMatch(publicWrapper, /طلب تأجيل زيارة|postponement-request/);
});

test('download QR is fixed in the right footer column without changing PDF generation', () => {
  assert.match(printLoader, /visit-permit-engine\.js/);
  assert.match(layout, /permit-download-qr/);
  assert.match(layout, /permit-footer-note/);
  assert.match(layout, /grid-template-columns:72px minmax\(0,1fr\)/);
  assert.match(layout, /downloadQr\.style\.cssText = 'grid-column:1/);
  assert.match(layout, /direction:rtl/);
  assert.doesNotMatch(layout, /printPayload|renderPdf|loadPublic/);
});

test('new scripts and public page inline scripts are syntactically valid and avoid native dialogs', () => {
  for (const [name, source] of Object.entries({ printLoader, layout, hospitalMode, centerKiosk })) {
    new vm.Script(source, { filename: name + '.js' });
    assert.doesNotMatch(source, /(?<![\w.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/);
  }
  for (const source of inlineScripts(publicWrapper)) new vm.Script(source, { filename: 'visit-request-form.html' });
});
