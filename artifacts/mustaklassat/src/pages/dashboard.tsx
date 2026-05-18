import { useGetMe } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { useState, useEffect } from "react";
import {
  Phone, Briefcase, Hash, Calendar, MessageSquare, PlayCircle, Activity,
  Zap, UserPlus, Building2,
} from "lucide-react";
import { ALL_MODULES, getSiteType, parseAllowedModules, filterModules } from "@/lib/modules";

const ISLAMIC_REMINDERS = [
  { type: "quran", text: "إِنَّ اللَّهَ يَأْمُرُكُمْ أَن تُؤَدُّوا الْأَمَانَاتِ إِلَىٰ أَهْلِهَا", source: "سورة النساء — الآية ٥٨" },
  { type: "hadith", text: "إِنَّ اللَّهَ يُحِبُّ إِذَا عَمِلَ أَحَدُكُمْ عَمَلاً أَنْ يُتْقِنَهُ", source: "رواه البيهقي — صحيح" },
  { type: "quran", text: "وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ", source: "سورة التوبة — الآية ١٠٥" },
  { type: "hadith", text: "مَنْ غَشَّنَا فَلَيْسَ مِنَّا", source: "رواه مسلم" },
  { type: "quran", text: "إِنَّ خَيْرَ مَنِ اسْتَأْجَرْتَ الْقَوِيُّ الْأَمِينُ", source: "سورة القصص — الآية ٢٦" },
  { type: "hadith", text: "أَدِّ الأَمَانَةَ إِلَى مَنِ ائْتَمَنَكَ، وَلَا تَخُنْ مَنْ خَانَكَ", source: "رواه أبو داود والترمذي" },
  { type: "quran", text: "وَأَحْسِنُوا ۛ إِنَّ اللَّهَ يُحِبُّ الْمُحْسِنِينَ", source: "سورة البقرة — الآية ١٩٥" },
  { type: "hadith", text: "عَلَيْكُمْ بِالصِّدْقِ فَإِنَّ الصِّدْقَ يَهْدِي إِلَى الْبِرِّ", source: "رواه البخاري ومسلم" },
  { type: "quran", text: "فَإِذَا فَرَغْتَ فَانصَبْ ۝ وَإِلَىٰ رَبِّكَ فَارْغَب", source: "سورة الشرح — الآيتان ٧–٨" },
  { type: "hadith", text: "إِنَّ اللَّهَ كَتَبَ الإِحْسَانَ عَلَى كُلِّ شَيْءٍ", source: "رواه مسلم" },
  { type: "quran", text: "إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ", source: "سورة التوبة — الآية ١٢٠" },
  { type: "hadith", text: "الدِّينُ النَّصِيحَةُ… لِلَّهِ وَلِكِتَابِهِ وَلِرَسُولِهِ وَلِأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ", source: "رواه مسلم" },
];

function IslamicReminderCard() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % ISLAMIC_REMINDERS.length);
        setVisible(true);
      }, 500);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const item = ISLAMIC_REMINDERS[idx];
  const isQuran = item.type === "quran";

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "linear-gradient(135deg,#0f2050 0%,#1e3c72 60%,#2a5298 100%)", boxShadow: "0 4px 20px rgba(30,60,114,0.15)" }}>
      <div className="h-0.5" style={{ background: "linear-gradient(90deg,#d4af37,#f0d060,#d4af37)" }} />
      <div className="p-6 text-center" style={{ direction: "rtl" }}>
        {/* Label */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              background: isQuran ? "rgba(212,175,55,0.2)" : "rgba(134,239,172,0.15)",
              color: isQuran ? "#d4af37" : "#86efac",
              border: `1px solid ${isQuran ? "rgba(212,175,55,0.35)" : "rgba(134,239,172,0.3)"}`,
              letterSpacing: "0.06em",
            }}>
            {isQuran ? "✦ آية قرآنية كريمة ✦" : "☽ حديث شريف ☽"}
          </span>
        </div>

        {/* Text */}
        <div style={{ transition: "opacity 0.5s ease", opacity: visible ? 1 : 0, minHeight: 72 }}>
          <p className="font-black leading-loose mb-3"
            style={{
              color: "#ffffff",
              fontSize: "clamp(15px,2vw,20px)",
              fontFamily: "'Tajawal',sans-serif",
              textShadow: "0 1px 10px rgba(0,0,0,0.3)",
            }}>
            {isQuran ? `﴿ ${item.text} ﴾` : `« ${item.text} »`}
          </p>
          <p className="text-xs font-semibold" style={{ color: "rgba(212,175,55,0.75)" }}>
            — {item.source}
          </p>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-5">
          {ISLAMIC_REMINDERS.map((r, i) => (
            <button key={i}
              onClick={() => { setVisible(false); setTimeout(() => { setIdx(i); setVisible(true); }, 300); }}
              title={r.type === "quran" ? "آية" : "حديث"}
              style={{
                width: i === idx ? 22 : 6, height: 6, borderRadius: 99, border: "none", cursor: "pointer",
                background: i === idx ? (r.type === "quran" ? "#d4af37" : "#86efac") : "rgba(255,255,255,0.2)",
                transition: "all 0.35s ease", padding: 0,
              }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ov(page: string) { return `/original-viewer?page=${page}`; }


function formatLastLogin(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("ar-SA", {
      weekday: "long", year: "numeric", month: "long",
      day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (diff < 60000) return "الآن";
  if (min < 60) return `منذ ${min} دقيقة`;
  if (hr < 24) return `منذ ${hr} ساعة`;
  if (day < 7) return `منذ ${day} يوم`;
  return new Date(iso).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

function isActiveNow(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000;
}

function roleLabel(role: string) {
  if (role === "admin") return { text: "مدير النظام", color: "#d4af37" };
  if (role === "supervisor") return { text: "مدير مستخلصات", color: "#f59e0b" };
  return { text: "مستخدم معتمد", color: "rgba(255,255,255,0.7)" };
}

export default function Dashboard() {
  const { user } = useUser();
  const { data: dbUser } = useGetMe({ query: { queryKey: ["/api/users/me"] } });
  const lastLogin = formatLastLogin((dbUser as any)?.lastLoginAt);

  if (
    dbUser &&
    dbUser.role !== "admin" &&
    dbUser.role !== "supervisor" &&
    (dbUser as any).hospital === "مستشفى نجران العام الجديد"
  ) {
    window.location.replace("/original-viewer?page=najran_general.html");
    return null;
  }

  const role = dbUser?.role ?? "user";
  const siteType = getSiteType(dbUser?.hospital);
  const allowedKeys = parseAllowedModules((dbUser as any)?.allowedModules);
  const visibleModules = filterModules(siteType, allowedKeys, role);

  const lastPage = (dbUser as any)?.lastPage as string | null;
  const lastPageAt = (dbUser as any)?.lastPageAt as string | null;
  const lastModule = lastPage ? ALL_MODULES.find(m => m.label === lastPage) ?? null : null;
  const isActive = isActiveNow(lastPageAt);
  const roleMeta = dbUser?.role ? roleLabel(dbUser.role) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-8" style={{ direction: "rtl" }}>

      {/* ═══ Hero Card ═══ */}
      <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: "linear-gradient(135deg,#0f2050 0%,#1e3c72 50%,#2a5298 100%)" }}>
        {/* Top stripe */}
        <div className="h-1" style={{ background: "linear-gradient(90deg,#d4af37,#f0d060,#d4af37)" }} />

        <div className="p-6 flex flex-col gap-5">
          {/* Name + status row */}
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
              style={{ background: "rgba(212,175,55,0.18)", border: "2px solid rgba(212,175,55,0.4)", color: "#d4af37" }}>
              {(dbUser?.name || user?.fullName || "م").charAt(0)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold text-white truncate">
                  أهلاً، {dbUser?.name || user?.fullName || "مستخدم"}
                </h1>
                {isActive && (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    نشط الآن
                  </span>
                )}
              </div>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 2 }}>
                برنامج المستخلصات الشهرية — وحدة الصيانة العامة
              </p>
              {roleMeta && (
                <p className="text-xs font-semibold mt-1" style={{ color: roleMeta.color }}>
                  ● {roleMeta.text}
                </p>
              )}
            </div>

            <img src="/logo.png" alt="" className="h-14 w-auto drop-shadow-lg flex-shrink-0 opacity-80"
              onError={e => (e.target as HTMLImageElement).style.display = "none"} />
          </div>

          {/* User details */}
          {(() => {
            const COMPANY_LABELS: Record<string, string> = {
              "تجمع_نجران": "تجمع نجران الصحي",
              "بيت_العرب": "بيت العرب",
              "سراكو": "سراكو",
            };
            const companyKey = (dbUser as any)?.company as string | undefined;
            const companyLabel = companyKey ? (COMPANY_LABELS[companyKey] || companyKey) : null;
            const hospital = (dbUser as any)?.hospital as string | undefined;
            const items = [
              { icon: Phone, label: "الهاتف", value: (dbUser as any)?.phone },
              { icon: Building2, label: "الشركة المقاولة", value: companyLabel },
              { icon: Building2, label: "المستشفى / الموقع", value: hospital },
              { icon: Briefcase, label: "الوظيفة", value: (dbUser as any)?.jobTitle },
              { icon: Hash, label: "رقم العقد", value: (dbUser as any)?.contractNumber },
            ].filter(i => i.value);
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1rem" }}>
                {items.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5">
                    <div className="mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(212,175,55,0.15)" }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: "#d4af37" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.05em" }}>{label}</div>
                      <div className="font-semibold text-white" style={{ fontSize: 13, marginTop: 1 }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Resume last work */}
          {lastModule && (
            <div className="flex items-center justify-between rounded-xl p-3 gap-3"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: lastModule.color }}>
                  <lastModule.icon className="h-4.5 w-4.5 text-white h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>آخر صفحة كنت عليها</p>
                  <p className="font-bold text-white truncate" style={{ fontSize: 14 }}>{lastPage}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{relativeTime(lastPageAt)}</span>
                <a href={ov(lastModule.file)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold text-sm no-underline transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", color: "#1e3c72" }}>
                  <PlayCircle className="h-4 w-4" />
                  استئناف
                </a>
              </div>
            </div>
          )}

          {/* Last login */}
          {lastLogin && (
            <div className="flex items-center gap-2" style={{ opacity: 0.5, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem" }}>
              <Calendar className="h-3.5 w-3.5" style={{ color: "#d4af37" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>آخر تسجيل دخول: {lastLogin}</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Islamic Reminder ═══ */}
      <IslamicReminderCard />

      {/* ═══ Modules Grid ═══ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "#1e3c72" }}>
            <Zap className="h-5 w-5" style={{ color: "#d4af37" }} />
            وحدات النظام
          </h2>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" />
            {visibleModules.length} وحدة متاحة
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleModules.map(m => {
            const Icon = m.icon;
            const isCurrentPage = lastPage === m.label;
            return (
              <a key={m.key} href={ov(m.file)}
                className="group rounded-xl p-4 text-center transition-all duration-200 hover:-translate-y-1 no-underline flex flex-col items-center gap-3 relative overflow-hidden"
                style={{
                  background: isCurrentPage ? `linear-gradient(135deg,${m.color}14,${m.color}22)` : "#fff",
                  border: isCurrentPage ? `2px solid ${m.color}55` : "1.5px solid #e8edf7",
                  boxShadow: isCurrentPage
                    ? `0 4px 20px ${m.color}22`
                    : "0 2px 8px rgba(30,60,114,0.05)",
                }}>

                {/* "last active" badge */}
                {isCurrentPage && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full px-1.5 py-0.5"
                    style={{ background: m.color, fontSize: 9, color: "#fff", fontWeight: 700 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse inline-block" />
                    آخر صفحة
                  </div>
                )}

                <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                  style={{ background: m.color, boxShadow: `0 4px 12px ${m.color}44` }}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="font-bold text-sm leading-tight" style={{ color: "#1e3c72" }}>{m.label}</span>
              </a>
            );
          })}

          {/* مذكرة دعم */}
          <a href="/support"
            className="group rounded-xl p-4 text-center transition-all duration-200 hover:-translate-y-1 no-underline flex flex-col items-center gap-3"
            style={{ background: "linear-gradient(135deg,#0096c7,#0077b6)", border: "1.5px solid #0077b6", boxShadow: "0 4px 15px rgba(0,150,199,0.2)" }}>
            <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-white/20">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-sm text-white">مذكرة دعم</span>
          </a>

          {/* Admin panel */}
          {(dbUser?.role === "admin") && (
            <a href="/admin/users"
              className="group rounded-xl p-4 text-center transition-all duration-200 hover:-translate-y-1 no-underline flex flex-col items-center gap-3"
              style={{ background: "linear-gradient(135deg,#d4af37,#b8962e)", border: "1.5px solid #b8962e", boxShadow: "0 4px 15px rgba(212,175,55,0.25)" }}>
              <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-white/20">
                <UserPlus className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-sm text-white">إدارة المستخدمين</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
