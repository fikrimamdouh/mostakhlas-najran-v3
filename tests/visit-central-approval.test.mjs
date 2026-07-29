import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const route = read('artifacts/api-server/src/routes/visits-central-approval.ts');
const routesIndex = read('artifacts/api-server/src/routes/index.ts');
const viewer = read('artifacts/mustaklassat/src/pages/OriginalViewer.tsx');
const appIndex = read('artifacts/mustaklassat/index.html');
const centerControl = read('artifacts/mustaklassat/public/original/visit-central-approval.js');

test('central fallback approval is permission-gated and mounted before the main visit router', () => {
  assert.match(route, /requireAuth[\s\S]*requireClusterVisitManagement/);
  assert.match(route, /router\.patch\([\s\S]*management\/visits\/:id\/facility-approve/);
  assert.match(routesIndex, /import visitsCentralApprovalRouter from "\.\/visits-central-approval"/);
  assert.ok(
    routesIndex.indexOf('router.use("/visits", visitsCentralApprovalRouter)') <
      routesIndex.indexOf('router.use("/visits", visitsRouter)'),
    'central approval router must be mounted before the catch-all visit router',
  );
});

test('central fallback approval is recorded under the visit site, not the operator name', () => {
  assert.match(route, /const approverName = visit\.siteLocation/);
  assert.match(route, /const CENTRAL_APPROVER_TITLE = "مدير وحدة الصيانة العامة بتجمع نجران الصحي"/);
  assert.doesNotMatch(route, /const approverName =[\s\S]{0,180}req\.currentUser\?\.name/);
  assert.match(route, /decidedByUserId: req\.currentUser\.id/);
  assert.match(route, /approvalRecordedAs: approverName/);
});

test('central fallback approval only reports success after a confirmed persisted approval id', () => {
  assert.match(route, /function approvalPayload\(approval/);
  assert.match(route, /id: approval\.id/);
  assert.match(route, /status: approval\.status/);
  assert.match(route, /if \(!approval\?\.id \|\| approval\.status !== "approved"\)/);
  assert.match(route, /facilityApproval: approvalPayload\(approval\)/);
  assert.match(route, /visit\.status !== "approved"/);
  assert.match(route, /visit\.archivedAt/);
});

test('central fallback approval preserves explicit facility decisions and is idempotent', () => {
  assert.match(route, /existingApproval\?\.status === "rejected"/);
  assert.match(route, /FACILITY_REJECTION_EXISTS/);
  assert.match(route, /existingApproval\?\.status === "approved"/);
  assert.match(route, /alreadyApproved: true/);
  assert.match(route, /alreadyApproved: false/);
});

test('visit management center loads one-click approval control and validates the server response', () => {
  assert.match(viewer, /page === "cluster-subcontractor-visits\.html"/);
  assert.match(viewer, /visit-central-approval\.js\?v=20260729_direct_representative_binding_v1/);
  assert.match(viewer, /FRAME_POLICY_CACHE_VERSION = "20260729_visit_representative_binding_v1"/);
  assert.match(centerControl, /اعتماد الزيارة/);
  assert.match(centerControl, /management\/visits\/.*\/facility-approve/);
  assert.match(centerControl, /result\.approved !== true/);
  assert.match(centerControl, /!result\.facilityApproval\.id/);
  assert.match(centerControl, /result\.facilityApproval\.status !== 'approved'/);
  assert.match(centerControl, /حفظ القرار باسم الموقع/);
  assert.match(centerControl, /function facilityRejected\(\)/);
  assert.match(centerControl, /المنشأة رفضت الزيارة/);
  assert.match(centerControl, /setButtonState\(button, 'btn btn-green', true/);
});

test('visit detail modal observer is throttled and button rendering is idempotent', () => {
  assert.match(centerControl, /var ensureScheduled = false/);
  assert.match(centerControl, /if \(ensureScheduled\) return/);
  assert.match(centerControl, /requestAnimationFrame/);
  assert.match(centerControl, /if \(button\.className !== className\)/);
  assert.match(centerControl, /if \(button\.disabled !== disabled\)/);
  assert.match(centerControl, /if \(button\.textContent !== label\)/);
  assert.match(centerControl, /attributeFilter: \['class'\]/);
  assert.doesNotMatch(centerControl, /function applyButtonState\(button\)[\s\S]*?button\.innerHTML\s*=/);
  assert.match(centerControl, /__NAJRAN_CENTRAL_VISIT_APPROVAL_V3__/);
});

test('application shell has a second guarded loader for the visit approval control', () => {
  assert.match(appIndex, /params\.get\('page'\) !== 'cluster-subcontractor-visits\.html'/);
  assert.match(appIndex, /iframe\[title="cluster-subcontractor-visits\.html"\]/);
  assert.match(appIndex, /najran-central-visit-approval-loader/);
  assert.match(appIndex, /visit-central-approval\.js\?v=20260722_central_site_approval_v2/);
  assert.match(appIndex, /doc\.getElementById\(loaderId\)/);
  assert.match(appIndex, /central approval control loaded/);
});
