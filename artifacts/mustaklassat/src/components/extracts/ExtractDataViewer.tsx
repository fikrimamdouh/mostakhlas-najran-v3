/**
 * ExtractDataViewer — معاينة احترافية للمستخلص
 * يعرض لقطة localStorage المحفوظة كصفحة مراجعة Read-Only بدل JSON خام.
 */

interface Props {
  extractType: string;
  extractData: Record<string, any> | null;
}

function fmt(n: any) {
  const v = Number(n);
  if (n === null || n === undefined || n === "" || isNaN(v)) return "—";
  return v.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function asText(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return "بيانات محفوظة";
  return String(v);
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-2">
      <div className="h-1 w-7 rounded" style={{ background: "#d4af37" }} />
      <div>
        <h3 className="font-extrabold text-sm" style={{ color: "#1e3c72" }}>{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 h-px" style={{ background: "#e8edf7" }} />
    </div>
  );
}

function InfoCard({ label, value, strong = false }: { label: string; value: any; strong?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
      <p className="text-[11px] text-gray-400 mb-1">{label}</p>
      <p className={strong ? "font-extrabold text-base" : "font-bold text-sm"} style={{ color: "#1e3c72" }}>
        {asText(value)}
      </p>
    </div>
  );
}

function StatusLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: ok ? "#f0fdf4" : "#fff7ed", border: ok ? "1px solid #bbf7d0" : "1px solid #fed7aa" }}>
      <span className="text-sm text-gray-700">{label}</span>
      <span className={ok ? "text-green-700 font-bold text-sm" : "text-orange-700 font-bold text-sm"}>
        {ok ? "✓ موجود" : "تنبيه"}
      </span>
    </div>
  );
}

function getExtractInfo(data: Record<string, any>) {
  const e = data["persistentExtractData"] || {};
  return {
    month: e.extractMonth || data.extractMonth || "",
    year: e.extractYear || data.extractYear || "",
    start: e.extractStart || data.extractStart || "",
    end: e.extractEnd || data.extractEnd || "",
    paymentNumber: e.paymentNumber || data.paymentNumber || "",
    duration: e.extractDuration || "",
  };
}

function ContractHeader({ data, extractType }: { data: Record<string, any>; extractType: string }) {
  const contract = data["persistentContractData"] || {};
  const info = getExtractInfo(data);
  const typeLabel: Record<string, string> = {
    labor: "مستخلص العمالة",
    consumables: "مستخلص المستهلكات",
    spare_parts: "مستخلص قطع الغيار",
    health_centers: "مستخلص المراكز الصحية",
    admin_offices: "مستخلص المكاتب الإدارية",
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #d9e2f3" }}>
      <div className="p-5" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-white/60 mb-1">معاينة Read-Only</p>
            <h2 className="text-xl font-extrabold">{typeLabel[extractType] || extractType}</h2>
            <p className="text-sm text-white/75 mt-1">
              {contract.hospitalName || data.hospitalName || "—"} · {info.month || "—"} {info.year || ""}
            </p>
          </div>
          <div className="rounded-xl px-5 py-3 text-center" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}>
            <p className="text-xs text-white/60">رقم الدفعة</p>
            <p className="text-2xl font-extrabold" style={{ color: "#d4af37" }}>{info.paymentNumber || "—"}</p>
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3" style={{ background: "#fff" }}>
        <InfoCard label="الشركة" value={contract.companyName || data.companyName} />
        <InfoCard label="رقم العقد" value={contract.contractNumber || data.contractNumber} />
        <InfoCard label="من تاريخ" value={info.start} />
        <InfoCard label="إلى تاريخ" value={info.end} />
      </div>
    </div>
  );
}

function QualityChecks({ data }: { data: Record<string, any> }) {
  const info = getExtractInfo(data);
  const contract = data["persistentContractData"] || {};
  const hasAttendance = Object.keys(data).some(k => k.toLowerCase().includes("attendance"));
  const hasPerformance = Object.keys(data).some(k => k.toLowerCase().includes("performance"));
  const hasTotal = Boolean(data["finalLaborCost"] || data["finalConsumablesCost"] || data["grand-net-total"] || data["sparePartsTotalAmount"]);

  return (
    <>
      <SectionTitle title="فحص المطابقة قبل الاعتماد" subtitle="قراءة سريعة لأهم بيانات المستخلص المحفوظة" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <StatusLine ok={!!info.paymentNumber} label="رقم الدفعة" />
        <StatusLine ok={!!(info.start && info.end)} label="تاريخ البداية والنهاية" />
        <StatusLine ok={!!(contract.hospitalName || data.hospitalName)} label="الموقع / المستشفى" />
        <StatusLine ok={!!(contract.companyName || data.companyName)} label="الشركة" />
        <StatusLine ok={hasAttendance} label="بيانات الحضور والانصراف" />
        <StatusLine ok={hasPerformance} label="بيانات الأداء" />
        <StatusLine ok={hasTotal} label="إجمالي المستخلص" />
      </div>
    </>
  );
}

function DataSummary({ data }: { data: Record<string, any> }) {
  const keys = Object.keys(data);
  const operational = keys.filter(k =>
    k.includes("attendance") ||
    k.includes("performance") ||
    k.includes("consumables") ||
    k.includes("spare") ||
    k.includes("achievement") ||
    k.includes("final") ||
    k.includes("grand-net")
  );

  return (
    <>
      <SectionTitle title="محتويات لقطة المستخلص" subtitle="بيانات محفوظة للرجوع إليها أثناء المراجعة" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard label="إجمالي المفاتيح المحفوظة" value={keys.length} strong />
        <InfoCard label="مفاتيح تشغيلية" value={operational.length} strong />
        <InfoCard label="إجمالي العمالة" value={data["finalLaborCost"] ? `${fmt(data["finalLaborCost"])} ر.س` : "—"} />
        <InfoCard label="إجمالي المستهلكات" value={data["finalConsumablesCost"] ? `${fmt(data["finalConsumablesCost"])} ر.س` : "—"} />
      </div>

      {operational.length > 0 && (
        <div className="mt-3 rounded-xl p-3" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
          <p className="text-xs text-gray-400 mb-2">أهم البيانات المرفقة</p>
          <div className="flex flex-wrap gap-2">
            {operational.slice(0, 28).map(k => (
              <span key={k} className="text-xs px-2 py-1 rounded-full" style={{ background: "#fff", border: "1px solid #dbe5f5", color: "#1e3c72" }}>
                {k}
              </span>
            ))}
            {operational.length > 28 && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">+{operational.length - 28}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SparePartsView({ data }: { data: Record<string, any> }) {
  const raw = data["najran_spare_parts_v1"];
  const rows = raw?.rows && Array.isArray(raw.rows) ? raw.rows.filter((r: any) => r.name || r.desc) : [];

  if (rows.length === 0) {
    return <DataSummary data={data} />;
  }

  return (
    <>
      <SectionTitle title="قائمة قطع الغيار" />
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#e8edf7" }}>
        <table className="w-full text-sm text-right" style={{ direction: "rtl" }}>
          <thead style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)", color: "#fff" }}>
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">اسم القطعة</th>
              <th className="px-3 py-2">الوصف</th>
              <th className="px-3 py-2">الوحدة</th>
              <th className="px-3 py-2">الكمية</th>
              <th className="px-3 py-2">السعر</th>
              <th className="px-3 py-2">الإجمالي</th>
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
        </table>
      </div>
    </>
  );
}

function ConsumablesView({ data }: { data: Record<string, any> }) {
  const total = data["finalConsumablesCost"] || data["grand-net-total"];
  const keys = Object.keys(data).filter(k => k.toLowerCase().includes("consumables") || k.toLowerCase().includes("subcontractors") || k.toLowerCase().includes("water") || k.toLowerCase().includes("sewage"));

  return (
    <div className="space-y-4">
      <DataSummary data={data} />
      {total && (
        <div className="rounded-xl p-4 text-center" style={{ background: "linear-gradient(135deg,#1e3c72,#2a5298)" }}>
          <p className="text-white/70 text-xs mb-1">إجمالي مستخلص المستهلكات</p>
          <p className="text-3xl font-extrabold text-white">{fmt(total)} ر.س</p>
        </div>
      )}
      {keys.length > 0 && (
        <>
          <SectionTitle title="بنود المستهلكات المحفوظة" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {keys.slice(0, 16).map(k => (
              <div key={k} className="rounded-lg px-3 py-2 text-sm" style={{ background: "#f8f9fe", border: "1px solid #e8edf7" }}>
                <span className="font-medium" style={{ color: "#1e3c72" }}>{k}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LaborView({ data }: { data: Record<string, any> }) {
  const total = data["finalLaborCost"] || data["grand-net-total"];
  const centers = data["centerNames_v3"] || data["centerNames"] || {};
  const attendanceKeys = Object.keys(data).filter(k => k.toLowerCase().includes("attendance"));
  const performanceKeys = Object.keys(data).filter(k => k.toLowerCase().includes("performance"));

  return (
    <div className="space-y-4">
      {Object.keys(centers).length > 0 && (
        <>
          <SectionTitle title="المواقع / المراكز" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(centers).map(([k, v]: [string, any]) => (
              <div key={k} className="rounded-lg px-3 py-2 text-sm" style={{ background: "#f0f2f8" }}>
                <span className="text-gray-400 text-xs">{k}: </span>
                <span className="font-medium" style={{ color: "#1e3c72" }}>{String(v)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle title="ملخص الحضور والأداء" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard label="جداول الحضور المحفوظة" value={attendanceKeys.length} strong />
        <InfoCard label="جداول الأداء المحفوظة" value={performanceKeys.length} strong />
        <InfoCard label="إجمالي العمالة" value={total ? `${fmt(total)} ر.س` : "—"} strong />
        <InfoCard label="حالة المعاينة" value="Read Only" />
      </div>

      <DataSummary data={data} />
    </div>
  );
}

function HealthCentersView({ data }: { data: Record<string, any> }) {
  return (
    <div className="space-y-4">
      <LaborView data={data} />
      <ConsumablesView data={data} />
    </div>
  );
}

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
    <div className="mt-2 space-y-5" style={{ direction: "rtl" }}>
      <ContractHeader data={extractData} extractType={extractType} />
      <QualityChecks data={extractData} />

      {extractType === "spare_parts" && <SparePartsView data={extractData} />}
      {extractType === "consumables" && <ConsumablesView data={extractData} />}
      {extractType === "labor" && <LaborView data={extractData} />}
      {extractType === "health_centers" && <HealthCentersView data={extractData} />}
      {!["spare_parts", "consumables", "labor", "health_centers"].includes(extractType) && <DataSummary data={extractData} />}
    </div>
  );
}
