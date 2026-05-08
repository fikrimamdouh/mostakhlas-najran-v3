/**
 * ExtractDataViewer — عرض البيانات الكاملة للمستخلص
 * يُحلّل لقطة localStorage المحفوظة ويعرضها بشكل جداول
 */

interface Props {
  extractType: string;
  extractData: Record<string, any> | null;
}

function fmt(n: any) {
  const v = Number(n);
  if (!n || isNaN(v)) return "—";
  return v.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-2">
      <div className="h-1 w-6 rounded" style={{ background: "#d4af37" }} />
      <h3 className="font-bold text-sm" style={{ color: "#1e3c72" }}>{title}</h3>
      <div className="flex-1 h-px" style={{ background: "#e8edf7" }} />
    </div>
  );
}

// ────────────────────────────────────────────────
// قطع الغيار
// ────────────────────────────────────────────────
function SparePartsView({ data }: { data: Record<string, any> }) {
  const raw = data["najran_spare_parts_v1"];
  if (!raw || !raw.rows) return <p className="text-sm text-gray-400">لا تتوفر بيانات تفصيلية لهذا المستخلص</p>;

  const rows = (raw.rows as any[]).filter(r => r.name || r.desc);
  if (rows.length === 0) return <p className="text-sm text-gray-400">الجدول فارغ</p>;

  return (
    <div>
      <SectionTitle title="قائمة قطع الغيار" />
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#e8edf7" }}>
        <table className="w-full text-sm text-right" style={{ direction: "rtl" }}>
          <thead style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
            <tr>
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">اسم القطعة</th>
              <th className="px-3 py-2 font-semibold">الوصف</th>
              <th className="px-3 py-2 font-semibold">الوحدة</th>
              <th className="px-3 py-2 font-semibold">الكمية</th>
              <th className="px-3 py-2 font-semibold">السعر</th>
              <th className="px-3 py-2 font-semibold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 text-gray-400">{r.num || i + 1}</td>
                <td className="px-3 py-2 font-medium text-gray-800">{r.name || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{r.desc || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{r.unit || "—"}</td>
                <td className="px-3 py-2 text-gray-700">{r.qty || "—"}</td>
                <td className="px-3 py-2 text-gray-700">{fmt(r.price)} ر.س</td>
                <td className="px-3 py-2 font-semibold" style={{ color: "#1e3c72" }}>{r.total || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f0f2f8" }}>
              <td colSpan={6} className="px-3 py-2 font-bold text-left text-gray-600">الإجمالي الكلي</td>
              <td className="px-3 py-2 font-extrabold" style={{ color: "#1e3c72" }}>
                {fmt(raw.totalAmount)} ر.س
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {(raw.sig1 || raw.sig2 || raw.sig3) && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[raw.sig1, raw.sig2, raw.sig3].map((s: string, i: number) => s ? (
            <div key={i} className="text-center rounded-lg py-2 text-xs" style={{ background: "#f0f2f8" }}>
              <div className="font-bold" style={{ color: "#1e3c72" }}>{s}</div>
              <div className="text-gray-400 mt-0.5">توقيع {i + 1}</div>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// المستهلكات — عمالة المقاولين
// ────────────────────────────────────────────────
function ConsumablesView({ data }: { data: Record<string, any> }) {
  const DB_VERSION = "consumables_v26_final";

  const subKey = `subcontractors_data_${DB_VERSION}`;
  const perfKey = `performance_data_${DB_VERSION}`;
  const waterKey = `water_supply_data_${DB_VERSION}`;
  const sewageKey = `sewage_disposal_data_${DB_VERSION}`;
  const summaryKey = `summary_data_${DB_VERSION}`;

  const subData = data[subKey];
  const summaryData = data[summaryKey];
  const grandTotal = data["grand-net-total"] || data["finalLaborCost"];

  const hasAny = subData || summaryData;
  if (!hasAny) return <p className="text-sm text-gray-400">لا تتوفر بيانات تفصيلية لهذا المستخلص</p>;

  return (
    <div className="space-y-2">
      {/* عمالة المقاولين */}
      {subData?.rows && Array.isArray(subData.rows) && subData.rows.length > 0 && (
        <>
          <SectionTitle title="عمالة المقاولين من الباطن" />
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#e8edf7" }}>
            <table className="w-full text-sm text-right" style={{ direction: "rtl" }}>
              <thead style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
                <tr>
                  <th className="px-3 py-2">الاسم</th>
                  <th className="px-3 py-2">الوظيفة</th>
                  <th className="px-3 py-2">المرتب</th>
                  <th className="px-3 py-2">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {subData.rows.filter((r: any) => r.name).map((r: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.job || r.position || "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{fmt(r.salary)} ر.س</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: "#1e3c72" }}>{fmt(r.total)} ر.س</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* الملخص */}
      {summaryData && (
        <>
          <SectionTitle title="ملخص المستهلكات" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(summaryData).filter(([, v]) => v && typeof v !== "object").map(([k, v]) => (
              <div key={k} className="rounded-lg p-3" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
                <p className="text-xs text-gray-400 mb-1">{k}</p>
                <p className="font-bold text-sm" style={{ color: "#1e3c72" }}>{String(v)}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* الإجمالي الكلي */}
      {grandTotal && (
        <div className="mt-4 rounded-xl p-4 text-center" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
          <p className="text-white/70 text-xs mb-1">الإجمالي الصافي الكلي</p>
          <p className="text-3xl font-extrabold text-white">{fmt(grandTotal)} ر.س</p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// مستخلص العمالة (حضور وانصراف + أداء)
// ────────────────────────────────────────────────
function LaborView({ data }: { data: Record<string, any> }) {
  const extractInfo = data["persistentExtractData"] || {};
  const total = data["finalLaborCost"] || data["grand-net-total"];

  // Find any attendance-like keys
  const attendanceKeys = Object.keys(data).filter(k =>
    k.toLowerCase().includes("attendance") ||
    k.toLowerCase().includes("worker") ||
    k.toLowerCase().includes("labor") ||
    k.toLowerCase().includes("حضور")
  );

  // Find center names
  const centers = data["centerNames_v3"] || data["centerNames"] || {};

  const hasUsefulData = total || extractInfo.extractMonth || Object.keys(centers).length > 0;

  if (!hasUsefulData) return (
    <p className="text-sm text-gray-400">
      لا تتوفر بيانات تفصيلية. البيانات التفصيلية تُحفظ ابتداءً من المستخلصات الجديدة.
    </p>
  );

  return (
    <div className="space-y-4">
      {/* بيانات الفترة */}
      {extractInfo.extractMonth && (
        <>
          <SectionTitle title="بيانات الفترة" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "الشهر", value: extractInfo.extractMonth },
              { label: "السنة", value: extractInfo.extractYear },
              { label: "من", value: extractInfo.extractStart },
              { label: "إلى", value: extractInfo.extractEnd },
              { label: "رقم الدفعة", value: extractInfo.paymentNumber },
            ].filter(i => i.value).map(item => (
              <div key={item.label} className="rounded-lg p-3" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className="font-bold text-sm" style={{ color: "#1e3c72" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* المراكز الصحية */}
      {Object.keys(centers).length > 0 && (
        <>
          <SectionTitle title="المراكز الصحية" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(centers).map(([k, v]: [string, any]) => (
              <div key={k} className="rounded-lg px-3 py-2 text-sm" style={{ background: "#f0f2f8" }}>
                <span className="text-gray-400 text-xs">{k}: </span>
                <span className="font-medium" style={{ color: "#1e3c72" }}>{v}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* بيانات الحضور (مفاتيح وُجدت) */}
      {attendanceKeys.length > 0 && (
        <>
          <SectionTitle title="بيانات الحضور والانصراف (مخزّنة)" />
          <div className="text-xs rounded-xl p-3 overflow-x-auto" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
            {attendanceKeys.map(k => {
              const val = data[k];
              return (
                <div key={k} className="mb-2">
                  <span className="font-mono text-blue-600">{k}:</span>
                  <span className="text-gray-600 mr-2">{typeof val === "object" ? JSON.stringify(val).slice(0, 200) : String(val).slice(0, 200)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* الإجمالي */}
      {total && (
        <div className="mt-2 rounded-xl p-4 text-center" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
          <p className="text-white/70 text-xs mb-1">إجمالي تكلفة العمالة</p>
          <p className="text-3xl font-extrabold text-white">{fmt(total)} ر.س</p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// المراكز الصحية — يشبه العمالة + مستهلكات
// ────────────────────────────────────────────────
function HealthCentersView({ data }: { data: Record<string, any> }) {
  return (
    <div>
      <LaborView data={data} />
      <ConsumablesView data={data} />
    </div>
  );
}

// ────────────────────────────────────────────────
// المكوّن الرئيسي
// ────────────────────────────────────────────────
export default function ExtractDataViewer({ extractType, extractData }: Props) {
  if (!extractData || Object.keys(extractData).length === 0) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: "#f8f9fe", border: "1px dashed #c7d2e8" }}>
        <p className="text-gray-400 text-sm">لا تتوفر بيانات تفصيلية لهذا المستخلص</p>
        <p className="text-gray-300 text-xs mt-1">البيانات التفصيلية ستُرفق في المستخلصات الجديدة</p>
      </div>
    );
  }

  return (
    <div className="mt-2" style={{ direction: "rtl" }}>
      {extractType === "spare_parts" && <SparePartsView data={extractData} />}
      {extractType === "consumables" && <ConsumablesView data={extractData} />}
      {extractType === "labor" && <LaborView data={extractData} />}
      {extractType === "health_centers" && <HealthCentersView data={extractData} />}
    </div>
  );
}
