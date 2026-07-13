import { useState } from "react";

export const PRE_REG_KEY = "najran_prereg";

const COMPANY_SITES = {
  "تجمع_نجران": {
    label: "تجمع نجران الصحي — وحدة الصيانة العامة",
    sites: [{ name: "المقر الرئيسي — تجمع نجران الصحي", contract: "" }],
  },
  "بيت_العرب": {
    label: "شركة مجموعة بيت العرب الحديثة المحدودة",
    sites: [
      { name: "مستشفى يدمه العام", contract: "250811180425" },
      { name: "مستشفى حبونا العام", contract: "250811180425" },
      { name: "مستشفى بدر الجنوب العام", contract: "250811180425" },
      { name: "مستشفى الولادة والأطفال", contract: "250701156483" },
      { name: "مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية", contract: "250701156483" },
      { name: "المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة", contract: "250701156483" },
    ],
  },
  "سراكو": {
    label: "شركة سراكو",
    sites: [
      { name: "مستشفى نجران العام الجديد ومركز طب الأسنان التخصصي", contract: "" },
      { name: "مجمع الأمل للصحة النفسية", contract: "" },
      { name: "مستشفى ثار العام", contract: "" },
      { name: "مستشفى خباش العام", contract: "" },
      { name: "المراكز الصحية", contract: "" },
      { name: "مستشفى الملك خالد", contract: "" },
      { name: "مركز الأمير سلطان", contract: "" },
      { name: "مستشفى شروره العام", contract: "" },
    ],
  },
  "زهران": {
    label: "شركة زهران للصيانة والتشغيل",
    sites: [
      { name: "مستشفى يدمه العام — زهران", contract: "" },
      { name: "مستشفى حبونا العام — زهران", contract: "" },
      { name: "مستشفى بدر الجنوب العام — زهران", contract: "" },
    ],
  },
  "إيمان": {
    label: "شركة إيمان للتجارة والمقاولات",
    sites: [
      { name: "مستشفى الولادة والأطفال — إيمان", contract: "" },
      { name: "مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية — إيمان", contract: "" },
      { name: "المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة — إيمان", contract: "" },
    ],
  },
} as const;

type CompanyKey = keyof typeof COMPANY_SITES;
type SiteEntry = { readonly name: string; readonly contract: string };

const selectStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%",
  borderRadius: "8px",
  border: `1px solid ${hasError ? "#f87171" : "#d1d5db"}`,
  background: "#fff",
  padding: "10px 16px",
  fontSize: "14px",
  outline: "none",
  appearance: "auto" as const,
  direction: "rtl",
});

export function PreRegistrationForm({ onNext }: { onNext: () => void }) {
  const [form, setForm] = useState({ fullName: "", phone: "", company: "" as CompanyKey | "", hospital: "", jobTitle: "", contractNumber: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});
  const companySites: readonly SiteEntry[] = form.company ? COMPANY_SITES[form.company].sites : [];

  const handleCompanyChange = (val: string) => {
    setForm(current => ({ ...current, company: val as CompanyKey | "", hospital: "", contractNumber: "" }));
    setErrors(current => ({ ...current, company: "", hospital: "" }));
  };

  const handleSiteChange = (siteName: string) => {
    const site = companySites.find(candidate => candidate.name === siteName);
    setForm(current => ({ ...current, hospital: siteName, contractNumber: site?.contract || "" }));
    setErrors(current => ({ ...current, hospital: "" }));
  };

  const validate = () => {
    const nextErrors: Partial<Record<keyof typeof form, string>> = {};
    if (!form.fullName.trim()) nextErrors.fullName = "الاسم الكامل مطلوب";
    if (!form.phone.trim()) nextErrors.phone = "رقم الهاتف مطلوب";
    else if (!/^05\d{8}$/.test(form.phone.replace(/\s/g, ""))) nextErrors.phone = "رقم هاتف غير صحيح (يبدأ بـ 05)";
    if (!form.company) nextErrors.company = "يرجى اختيار الشركة";
    if (!form.hospital.trim()) nextErrors.hospital = "يرجى اختيار الموقع";
    if (!form.jobTitle.trim()) nextErrors.jobTitle = "الوظيفة مطلوبة";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    sessionStorage.setItem(PRE_REG_KEY, JSON.stringify(form));
    try { localStorage.setItem(PRE_REG_KEY, JSON.stringify(form)); } catch {}
    onNext();
  };

  const inputClass = (key: keyof typeof form) => `w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[key] ? "border-red-400 bg-red-50" : ""}`;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4" style={{ background: "linear-gradient(135deg,#1e3c72 0%,#2a5298 100%)", direction: "rtl" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="" className="h-14 w-auto mx-auto mb-3 drop-shadow" onError={event => ((event.target as HTMLImageElement).style.display = "none")} />
          <h2 className="text-2xl font-extrabold" style={{ color: "#1e3c72" }}>إنشاء حساب جديد</h2>
          <p className="text-gray-500 text-sm mt-1">يرجى إدخال بياناتك الكاملة أولاً قبل التسجيل</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>الاسم الكامل <span className="text-red-500">*</span></label>
            <input type="text" value={form.fullName} onChange={event => { setForm(current => ({ ...current, fullName: event.target.value })); setErrors(current => ({ ...current, fullName: "" })); }} placeholder="محمد بن عبدالله الشهري" className={inputClass("fullName")} />
            {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>رقم الهاتف <span className="text-red-500">*</span></label>
            <input type="tel" value={form.phone} onChange={event => { setForm(current => ({ ...current, phone: event.target.value })); setErrors(current => ({ ...current, phone: "" })); }} placeholder="05XXXXXXXX" className={inputClass("phone")} />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>الشركة المقاولة <span className="text-red-500">*</span></label>
            <select value={form.company} onChange={event => handleCompanyChange(event.target.value)} style={selectStyle(!!errors.company)}>
              <option value="">— اختر الشركة —</option>
              {(Object.keys(COMPANY_SITES) as CompanyKey[]).map(key => <option key={key} value={key}>{COMPANY_SITES[key].label}</option>)}
            </select>
            {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
          </div>
          {form.company && (
            <div>
              <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>الموقع / المستشفى <span className="text-red-500">*</span></label>
              <select value={form.hospital} onChange={event => handleSiteChange(event.target.value)} style={selectStyle(!!errors.hospital)}>
                <option value="">— اختر الموقع —</option>
                {companySites.map(site => <option key={site.name} value={site.name}>{site.name}</option>)}
              </select>
              {errors.hospital && <p className="text-red-500 text-xs mt-1">{errors.hospital}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#1e3c72" }}>المسمى الوظيفي <span className="text-red-500">*</span></label>
            <input type="text" value={form.jobTitle} onChange={event => { setForm(current => ({ ...current, jobTitle: event.target.value })); setErrors(current => ({ ...current, jobTitle: "" })); }} placeholder="مهندس صيانة / محاسب / مشرف..." className={inputClass("jobTitle")} />
            {errors.jobTitle && <p className="text-red-500 text-xs mt-1">{errors.jobTitle}</p>}
          </div>
          <button type="submit" className="w-full h-12 rounded-xl font-bold text-base text-white mt-2 transition-opacity hover:opacity-90" style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#1e3c72" }}>التالي — إنشاء الحساب ←</button>
          <p className="text-center text-xs text-gray-400 mt-2">لديك حساب بالفعل؟ <a href="/sign-in" className="font-semibold" style={{ color: "#1e3c72" }}>تسجيل الدخول</a></p>
        </form>
      </div>
    </div>
  );
}
