import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('artifacts/api-server/src/routes/visits-incoming-workflow.ts');
const routesIndex = read('artifacts/api-server/src/routes/index.ts');
const client = read('artifacts/mustaklassat/public/original/visit-incoming-workflow.js');
const loader = read('artifacts/mustaklassat/public/original/visit-central-approval.js');

test('incoming workflow router is mounted before the main visits router', () => {
  assert.match(routesIndex, /import visitsIncomingWorkflowRouter from "\.\/visits-incoming-workflow"/);
  assert.ok(
    routesIndex.indexOf('router.use("/visits", visitsIncomingWorkflowRouter)') <
      routesIndex.indexOf('router.use("/visits", visitsRouter)'),
  );
});

test('editing preserves pending state and clears stale central links', () => {
  const block = route.match(/management\/incoming-visits\/:id\/edit[\s\S]*?router\.patch\(\n  "\/management\/incoming-visits\/:id\/approve"/);
  assert.ok(block);
  for (const value of ['representativeId: null', 'siteApprovalId: null', 'qualificationId: null', 'linkedAt: null', 'linkedByUserId: null']) {
    assert.match(block[0], new RegExp(value));
  }
  assert.match(block[0], /eq\(visitRequestsTable\.status, "pending"\)/);
  assert.match(block[0], /saved: true/);
  assert.doesNotMatch(block[0], /status: "approved"/);
});

test('approval is independent, atomic, idempotent and confirms permit data', () => {
  const block = route.match(/management\/incoming-visits\/:id\/approve[\s\S]*?export default router/);
  assert.ok(block);
  assert.match(route, /approvedWithoutLink: !metadata\?\.linkedAt/);
  assert.match(block[0], /pg_advisory_xact_lock/);
  assert.match(block[0], /context\.visit\.status === "approved" && context\.visit\.serialNumber/);
  assert.match(block[0], /nextPermitNumber\(tx\)/);
  assert.match(block[0], /ensurePermitToken\(tx, id\)/);
  assert.match(block[0], /status: "approved"/);
  assert.match(block[0], /approved: true/);
  assert.match(block[0], /serialNumber: result\.visit\.serialNumber/);
});

test('client separates edit, automatic link and approval', () => {
  assert.match(client, /data-incoming-edit/);
  assert.match(client, /data-incoming-link/);
  assert.match(client, /data-incoming-approve/);
  assert.match(client, /oldButton\.removeAttribute\('data-link'\)/);
  assert.match(client, /تم ربط بيانات الطلب فقط دون اعتماده/);
  assert.match(client, /result\.validForApproval !== true/);
  assert.match(client, /result\.visit\.status !== 'pending'/);
  assert.match(client, /result\.approved !== true/);
  assert.match(client, /stopImmediatePropagation/);
  for (const term of ['representativeSystems', 'siteApprovals', 'qualifications', 'representativeId', 'siteApprovalId', 'qualificationId']) {
    assert.match(client, new RegExp(term));
  }
});

test('visit management enhancement loads the separated incoming workflow', () => {
  assert.match(loader, /najran-incoming-visit-workflow-loader/);
  assert.match(loader, /visit-incoming-workflow\.js\?v=20260722_incoming_split_v1/);
});
