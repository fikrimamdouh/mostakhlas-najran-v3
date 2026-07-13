import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const guardSource = fs.readFileSync(
  new URL('../artifacts/mustaklassat/public/original/submitted_extract_archive_bundle_guard.js', import.meta.url),
  'utf8',
);

class StorageMock {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values).map(([key, value]) => [key, String(value)]));
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function json(value) {
  return JSON.stringify(value);
}

function createGuard(storageValues, finalReviewSnapshot, pathname = '/original/achievement.html') {
  const localStorage = new StorageMock(storageValues);
  const sessionStorage = new StorageMock();
  let originalFetchCalls = 0;
  const context = {
    console,
    document: { querySelector: () => null, getElementById: () => null },
    isFinite,
    localStorage,
    location: { pathname, search: '' },
    Promise,
    sessionStorage,
    setTimeout,
  };
  context.window = context;
  context.window.fetch = async () => {
    originalFetchCalls += 1;
    return { ok: true };
  };
  context.window.finalizeLaborExtractBeforeSubmit = () => finalReviewSnapshot;
  vm.createContext(context);
  vm.runInContext(guardSource, context);
  const guard = context.window.NajranSubmittedExtractArchiveGuard;
  guard.__test = { context, sessionStorage, originalFetchCalls: () => originalFetchCalls };
  return guard;
}

function completeFinalSnapshot() {
  return {
    schema: 'labor_final_review_snapshot_v1',
    finalAmount: { value: 0, text: '0.00 ر.س' },
    displayRows: [{ rowType: 'line', cells: ['إجمالي الاستحقاق', '0.00'] }],
    table: { headers: ['البند', 'القيمة'], rows: [{ rowType: 'line', cells: ['إجمالي الاستحقاق', '0.00'] }] },
    signatures: {
      attendance: [{ title: 'المشرف', name: 'أحمد' }],
      performance: [{ title: 'مدير الموقع', name: 'محمد' }],
      achievement: [{ title: 'مدير العقد', name: 'خالد' }],
      preferences: {},
      styles: {},
    },
  };
}

function payload(extractData, finalReviewSnapshot) {
  return {
    extractType: 'labor',
    companyName: 'شركة الاختبار',
    hospitalName: 'مستشفى الاختبار',
    extractMonth: 'يوليو',
    extractYear: '2026',
    paymentNumber: '7',
    totalAmount: 999,
    extractData: {
      ...extractData,
      finalReviewSnapshot,
      reviewSnapshotSchema: 'labor_final_review_snapshot_v1',
    },
  };
}

test('keeps a labor attendance key larger than 300KB and removes foreign extract data', () => {
  const finalReviewSnapshot = completeFinalSnapshot();
  const attendanceData = {
    cleaning: [{ name: 'عامل 1', days: { 1: 'ح' } }],
    padding: 'x'.repeat(350 * 1024),
  };
  const storage = {
    attendanceData: json(attendanceData),
    tableData_cleaning: json({ amount: 0, rows: [{ activity: 'النظافة', maxScore: 100, score: 100 }] }),
    sb_sigs_attendance: json(finalReviewSnapshot.signatures.attendance),
    sb_sigs_performance: json(finalReviewSnapshot.signatures.performance),
    sb_sigs_achievement: json(finalReviewSnapshot.signatures.achievement),
    consumablesTableData: json({ cleaning: [{ item: 'منظف' }] }),
    finalConsumablesCost: '555',
  };
  const guard = createGuard(storage, finalReviewSnapshot);
  const enriched = guard.enrichPayload(payload({
    attendanceData,
    tableData_cleaning: JSON.parse(storage.tableData_cleaning),
    consumablesTableData: JSON.parse(storage.consumablesTableData),
    finalConsumablesCost: 555,
  }, finalReviewSnapshot));

  assert.equal(enriched.extractData.attendanceData.padding.length, 350 * 1024);
  assert.equal(enriched.extractData.consumablesTableData, undefined);
  assert.equal(enriched.extractData.finalConsumablesCost, undefined);
  assert.equal(enriched.totalAmount, 0, 'zero labor total must remain a valid uploaded amount');
  assert.equal(enriched.extractData.__laborCompleteBundle_v1.complete, true);
  assert.equal(enriched.extractData.__laborCompleteBundle_v1.attendanceRows, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(enriched.extractData.__laborCompleteBundle_v1.signatures)),
    { attendance: 1, performance: 1, achievement: 1 },
  );
});

test('blocks labor upload when attendance rows are missing', () => {
  const finalReviewSnapshot = completeFinalSnapshot();
  const guard = createGuard({
    tableData_cleaning: json({ rows: [{ activity: 'النظافة', maxScore: 100, score: 100 }] }),
  }, finalReviewSnapshot);

  assert.throws(
    () => guard.enrichPayload(payload({ tableData_cleaning: { rows: [{ activity: 'النظافة' }] } }, finalReviewSnapshot)),
    /جداول الحضور والانصراف وصفوف العمال/,
  );
});

test('fetch guard never sends a partial labor bundle and clears its submit lock', async () => {
  const finalReviewSnapshot = completeFinalSnapshot();
  const guard = createGuard({
    tableData_cleaning: json({ rows: [{ activity: 'النظافة' }] }),
  }, finalReviewSnapshot);
  const incompletePayload = payload({ tableData_cleaning: { rows: [{ activity: 'النظافة' }] } }, finalReviewSnapshot);
  const lockKey = [
    'najran_submit_lock_submitted_extract',
    incompletePayload.extractType,
    incompletePayload.companyName,
    incompletePayload.hospitalName,
    incompletePayload.extractYear,
    incompletePayload.extractMonth,
    incompletePayload.paymentNumber,
  ].join('__');
  guard.__test.sessionStorage.setItem(lockKey, json({ startedAt: Date.now() }));

  await assert.rejects(
    guard.__test.context.window.fetch('/api/submitted-extracts', {
      method: 'POST',
      body: JSON.stringify(incompletePayload),
    }),
    /الحزمة غير مكتملة/,
  );
  assert.equal(guard.__test.originalFetchCalls(), 0, 'original fetch must not run for an incomplete bundle');
  assert.equal(guard.__test.sessionStorage.getItem(lockKey), null, 'failed upload must release its submit lock');
});

test('blocks an oversized complete bundle instead of dropping any table', () => {
  const finalReviewSnapshot = completeFinalSnapshot();
  const attendanceData = {
    cleaning: [{ name: 'عامل 1', days: { 1: 'ح' } }],
    padding: 'x'.repeat(4 * 1024 * 1024),
  };
  const guard = createGuard({
    attendanceData: json(attendanceData),
    tableData_cleaning: json({ rows: [{ activity: 'النظافة' }] }),
  }, finalReviewSnapshot);

  assert.throws(
    () => guard.enrichPayload(payload({ attendanceData, tableData_cleaning: { rows: [{ activity: 'النظافة' }] } }, finalReviewSnapshot)),
    /حد النقل الآمن 4MB/,
  );
});

test('review screen contains the frozen labor signatures section', () => {
  const reviewSource = fs.readFileSync(
    new URL('../artifacts/mustaklassat/public/original/review-labor-final-snapshot-exact.js', import.meta.url),
    'utf8',
  );
  assert.match(reviewSource, /توقيعات الحضور والانصراف/);
  assert.match(reviewSource, /توقيعات جداول الأداء/);
  assert.match(reviewSource, /توقيعات شهادة الإنجاز/);
  assert.match(reviewSource, /التوقيعات المحفوظة وقت الرفع/);
  assert.match(reviewSource, /frozenFinal !== null/);
  assert.doesNotMatch(reviewSource, /var final = num\([^\n]+\) \|\|/);
});

test('server transport validates UTF-8 bytes and does not echo the large snapshot after save', () => {
  const scopeSource = fs.readFileSync(
    new URL('../artifacts/api-server/src/lib/extract-scope.ts', import.meta.url),
    'utf8',
  );
  const routeSource = fs.readFileSync(
    new URL('../artifacts/api-server/src/routes/submitted-extracts.ts', import.meta.url),
    'utf8',
  );
  assert.match(scopeSource, /Buffer\.byteLength\(extractDataJson, "utf8"\)/);
  assert.match(routeSource, /savedExtractMutationResponse\(row\)/);
  assert.match(routeSource, /extractData: storedExtractDataForResponse/);
});

test('consumables upload contains only its complete section and signatures', () => {
  const storage = {
    summary_data_consumables_v27: json([{ item: 'منظف اختبار', total: 120 }]),
    subcontractors_data_consumables_v27: json([{ name: 'مقاول اختبار', amount: 20 }]),
    performance_data_consumables_v27: json([{ title: 'أداء اختبار', amount: 10 }]),
    water_supply_data_consumables_v27: json([{ amount: 5 }]),
    sewage_disposal_data_consumables_v27: json([{ amount: 3 }]),
    signatures_data_consumables_v27: json([{ title: 'المشرف', name: 'توقيع مستهلكات' }]),
    finalConsumablesCost: '158',
    attendanceData: json({ cleaning: [{ name: 'لا يدخل المستهلكات' }] }),
    tableData_cleaning: json({ rows: [{ activity: 'لا يدخل المستهلكات' }] }),
    spare_partsData: json({ rows: [{ item: 'لا يدخل المستهلكات' }] }),
  };
  const guard = createGuard(storage, null, '/original/consumables.html');
  const enriched = guard.enrichPayload({
    extractType: 'consumables',
    extractData: Object.fromEntries(Object.entries(storage).map(([key, value]) => [key, JSON.parse(value)])),
  });

  assert.deepEqual(enriched.extractData.summary_data_consumables_v27, [{ item: 'منظف اختبار', total: 120 }]);
  assert.deepEqual(enriched.extractData.signatures_data_consumables_v27, [{ title: 'المشرف', name: 'توقيع مستهلكات' }]);
  assert.equal(enriched.extractData.attendanceData, undefined);
  assert.equal(enriched.extractData.tableData_cleaning, undefined);
  assert.equal(enriched.extractData.spare_partsData, undefined);
  assert.equal(enriched.extractData.__submittedExtractArchiveBundle_v1.sourceModule, 'consumables');
});

test('spare-parts upload remains independent from labor and consumables', () => {
  const storage = {
    spare_partsData: json({ rows: [{ item: 'قطعة اختبار', amount: 250 }], totalAmount: 250 }),
    sparePartsTotalAmount: '250',
    attendanceData: json({ cleaning: [{ name: 'لا يدخل قطع الغيار' }] }),
    summary_data_consumables_v27: json([{ item: 'لا يدخل قطع الغيار' }]),
    signatures_data_consumables_v27: json([{ name: 'لا يدخل قطع الغيار' }]),
  };
  const guard = createGuard(storage, null, '/original/spare_parts.html');
  const enriched = guard.enrichPayload({
    extractType: 'spare_parts',
    extractData: Object.fromEntries(Object.entries(storage).map(([key, value]) => [key, JSON.parse(value)])),
  });

  assert.deepEqual(enriched.extractData.spare_partsData, { rows: [{ item: 'قطعة اختبار', amount: 250 }], totalAmount: 250 });
  assert.equal(enriched.extractData.sparePartsTotalAmount, 250);
  assert.equal(enriched.extractData.attendanceData, undefined);
  assert.equal(enriched.extractData.summary_data_consumables_v27, undefined);
  assert.equal(enriched.extractData.signatures_data_consumables_v27, undefined);
  assert.equal(enriched.extractData.__submittedExtractArchiveBundle_v1.sourceModule, 'spare_parts');
});

test('blocks an empty consumables or spare-parts upload before network submission', () => {
  const consumablesGuard = createGuard({}, null, '/original/consumables.html');
  assert.throws(
    () => consumablesGuard.enrichPayload({ extractType: 'consumables', extractData: {} }),
    /بيانات القسم الأساسية غير موجودة/,
  );

  const spareGuard = createGuard({}, null, '/original/spare_parts.html');
  assert.throws(
    () => spareGuard.enrichPayload({ extractType: 'spare_parts', extractData: {} }),
    /بيانات القسم الأساسية غير موجودة/,
  );
});

test('health-center attendance upload cannot carry health consumables or admin-office data', () => {
  const storage = {
    centersAttendanceData_v2: json({ centerA: [{ name: 'عامل مركز' }] }),
    healthCenters_Signatures_attendance: json([{ name: 'توقيع مركز' }]),
    healthCentersConsumables: json([{ item: 'لا يدخل حضور المراكز' }]),
    adminOfficesAttendanceData_v1: json({ officeA: [{ name: 'لا يدخل المراكز' }] }),
  };
  const guard = createGuard(storage, null, '/original/health_centers_attendance.html');
  const enriched = guard.enrichPayload({
    extractType: 'health_centers',
    extractData: Object.fromEntries(Object.entries(storage).map(([key, value]) => [key, JSON.parse(value)])),
  });

  assert.deepEqual(enriched.extractData.centersAttendanceData_v2, { centerA: [{ name: 'عامل مركز' }] });
  assert.equal(enriched.extractData.healthCentersConsumables, undefined);
  assert.equal(enriched.extractData.adminOfficesAttendanceData_v1, undefined);
  assert.equal(enriched.extractData.__submittedExtractArchiveBundle_v1.sourceModule, 'health_centers_attendance');
});
