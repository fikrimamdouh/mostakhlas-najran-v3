import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const snapshotSource = fs.readFileSync(
  new URL('../artifacts/mustaklassat/public/original/extract-snapshot.js', import.meta.url),
  'utf8',
);

class StorageMock {
  constructor(values = {}, maxWrittenChars = Infinity) {
    this.values = new Map(Object.entries(values).map(([key, value]) => [key, String(value)]));
    this.maxWrittenChars = maxWrittenChars;
  }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    const serialized = String(value);
    if (serialized.length > this.maxWrittenChars) throw new Error('QuotaExceededError');
    this.values.set(key, serialized);
  }
  removeItem(key) { this.values.delete(key); }
}

function json(value) { return JSON.stringify(value); }

function createSnapshotRuntime(pathname, values, maxWrittenChars = Infinity) {
  const localStorage = new StorageMock(values, maxWrittenChars);
  const location = { pathname, href: pathname, search: '' };
  const context = {
    clearInterval() {},
    console,
    document: {
      addEventListener() {},
      createElement() { return {}; },
      getElementById() { return null; },
      readyState: 'loading',
    },
    isFinite,
    localStorage,
    location,
    setInterval() { return 1; },
    setTimeout() { return 1; },
  };
  context.window = context;
  context.window.addEventListener = () => {};
  vm.createContext(context);
  vm.runInContext(snapshotSource, context);
  return { context, localStorage, location };
}

function commonValues() {
  return {
    persistentExtractData: json({
      extractMonth: 'يوليو',
      extractYear: '2026',
      paymentNumber: '99',
      extractStart: '2026-07-01',
      extractEnd: '2026-07-31',
    }),
    persistentContractData: json({
      hospitalName: 'موقع الاختبار الصناعي',
      companyName: 'شركة الاختبار الصناعي',
      contractDetails: 'TEST-ONLY-99',
    }),
  };
}

test('labor local save and resume preserve large attendance and image signatures without mixing sections', () => {
  const largeAttendance = {
    cleaning: [{ name: 'عامل اختبار', salary: 1000, days: { 1: 'ح', 2: 'غ' } }],
    padding: 'x'.repeat(350 * 1024),
  };
  const imageSignatures = [{ title: 'مدير الاختبار', name: 'توقيع صناعي', image: 'data:image/png;base64,' + 'a'.repeat(4096) }];
  const { context, localStorage, location } = createSnapshotRuntime('/original/attendance.html', {
    ...commonValues(),
    attendanceData: json(largeAttendance),
    dynamicSignatures: json(imageSignatures),
    tableData_cleaning: json({ rows: [{ activity: 'اختبار', score: 10 }] }),
    consumablesTableData: json([{ item: 'يجب ألا يدخل العمالة' }]),
    spare_partsData: json({ rows: [{ item: 'يجب ألا يدخل العمالة' }] }),
  });

  const saved = context.window.saveExtractSnapshot('acceptance-test');
  assert.ok(saved, 'complete local save must report success');
  assert.equal(saved.extractType, 'labor');
  assert.equal(saved.extractData.attendanceData.padding.length, 350 * 1024);
  assert.equal(saved.extractData.dynamicSignatures[0].image, imageSignatures[0].image);
  assert.equal(saved.extractData.consumablesTableData, undefined);
  assert.equal(saved.extractData.spare_partsData, undefined);

  localStorage.setItem('attendanceData', json({ cleaning: [{ name: 'بيانات مؤقتة' }] }));
  localStorage.setItem('dynamicSignatures', json([{ name: 'توقيع مؤقت' }]));
  const resumed = context.window.resumeExtractSnapshot(saved.id, { skipProtection: true });

  assert.equal(resumed, true);
  assert.deepEqual(JSON.parse(localStorage.getItem('attendanceData')), largeAttendance);
  assert.deepEqual(JSON.parse(localStorage.getItem('dynamicSignatures')), imageSignatures);
  assert.equal(location.href, '/original/attendance.html');
});

test('consumables and spare-parts local archives remain independent and round-trip their own totals', () => {
  const consumables = createSnapshotRuntime('/original/consumables.html', {
    ...commonValues(),
    summary_data_consumables_v27: json([{ item: 'منظف اختبار', total: 321 }]),
    signatures_data_consumables_v27: json([{ title: 'المشرف', name: 'توقيع مستهلكات' }]),
    finalConsumablesCost: '321',
    attendanceData: json({ cleaning: [{ name: 'لا يدخل المستهلكات' }] }),
    spare_partsData: json({ rows: [{ item: 'لا يدخل المستهلكات' }] }),
  });
  const consumablesSaved = consumables.context.window.saveExtractSnapshot('acceptance-test');
  assert.ok(consumablesSaved);
  assert.equal(consumablesSaved.extractType, 'consumables');
  assert.equal(consumablesSaved.extractData.finalConsumablesCost, 321);
  assert.equal(consumablesSaved.extractData.attendanceData, undefined);
  assert.equal(consumablesSaved.extractData.spare_partsData, undefined);
  consumables.localStorage.setItem('summary_data_consumables_v27', json([]));
  assert.equal(consumables.context.window.resumeExtractSnapshot(consumablesSaved.id, { skipProtection: true }), true);
  assert.deepEqual(JSON.parse(consumables.localStorage.getItem('summary_data_consumables_v27')), [{ item: 'منظف اختبار', total: 321 }]);

  const spareParts = createSnapshotRuntime('/original/spare_parts.html', {
    ...commonValues(),
    spare_partsData: json({ rows: [{ item: 'قطعة اختبار', amount: 654 }], totalAmount: 654 }),
    sparePartsTotalAmount: '654',
    attendanceData: json({ cleaning: [{ name: 'لا يدخل قطع الغيار' }] }),
    summary_data_consumables_v27: json([{ item: 'لا يدخل قطع الغيار' }]),
  });
  const spareSaved = spareParts.context.window.saveExtractSnapshot('acceptance-test');
  assert.ok(spareSaved);
  assert.equal(spareSaved.extractType, 'spare_parts');
  assert.equal(spareSaved.extractData.sparePartsTotalAmount, 654);
  assert.equal(spareSaved.extractData.attendanceData, undefined);
  assert.equal(spareSaved.extractData.summary_data_consumables_v27, undefined);
  spareParts.localStorage.setItem('spare_partsData', json({ rows: [] }));
  assert.equal(spareParts.context.window.resumeExtractSnapshot(spareSaved.id, { skipProtection: true }), true);
  assert.deepEqual(JSON.parse(spareParts.localStorage.getItem('spare_partsData')), { rows: [{ item: 'قطعة اختبار', amount: 654 }], totalAmount: 654 });
});

test('local save never reports success when the complete archive cannot be persisted', () => {
  const { context, localStorage } = createSnapshotRuntime('/original/attendance.html', {
    ...commonValues(),
    attendanceData: json({ cleaning: [{ name: 'عامل اختبار' }], padding: 'x'.repeat(350 * 1024) }),
  }, 64 * 1024);

  const saved = context.window.saveExtractSnapshot('quota-test');
  assert.equal(saved, null);
  assert.deepEqual(JSON.parse(localStorage.getItem('extractArchive') || '[]'), []);
});

test('health centers and admin offices snapshots restore only their own attendance data', () => {
  const centers = createSnapshotRuntime('/original/health_centers_attendance.html', {
    ...commonValues(),
    centersAttendanceData_v2: json({ centerA: [{ name: 'عامل مركز' }] }),
    healthCenters_Signatures_centerA: json([{ name: 'توقيع مركز' }]),
    adminOfficesAttendanceData_v1: json({ officeA: [{ name: 'لا يدخل المركز' }] }),
  });
  const centerSaved = centers.context.window.saveExtractSnapshot('acceptance-test');
  assert.ok(centerSaved);
  assert.equal(centerSaved.extractType, 'health_centers');
  assert.equal(centerSaved.extractData.adminOfficesAttendanceData_v1, undefined);
  centers.localStorage.setItem('centersAttendanceData_v2', json({}));
  assert.equal(centers.context.window.resumeExtractSnapshot(centerSaved.id, { skipProtection: true }), true);
  assert.deepEqual(JSON.parse(centers.localStorage.getItem('centersAttendanceData_v2')), { centerA: [{ name: 'عامل مركز' }] });

  const offices = createSnapshotRuntime('/original/admin_offices_attendance.html', {
    ...commonValues(),
    adminOfficesAttendanceData_v1: json({ officeA: [{ name: 'عامل مكتب' }] }),
    adminOfficeNames_v1: json(['مكتب اختبار']),
    centersAttendanceData_v2: json({ centerA: [{ name: 'لا يدخل المكتب' }] }),
  });
  const officeSaved = offices.context.window.saveExtractSnapshot('acceptance-test');
  assert.ok(officeSaved);
  assert.equal(officeSaved.extractType, 'admin_offices');
  assert.equal(officeSaved.extractData.centersAttendanceData_v2, undefined);
  offices.localStorage.setItem('adminOfficesAttendanceData_v1', json({}));
  assert.equal(offices.context.window.resumeExtractSnapshot(officeSaved.id, { skipProtection: true }), true);
  assert.deepEqual(JSON.parse(offices.localStorage.getItem('adminOfficesAttendanceData_v1')), { officeA: [{ name: 'عامل مكتب' }] });
});
