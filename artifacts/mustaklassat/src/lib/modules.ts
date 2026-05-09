import {
  Settings, SlidersHorizontal, Clock, BarChart2, Trophy, Package, Wrench,
  CheckSquare, MapPin, ClipboardList, Eye, Archive, type LucideIcon,
} from "lucide-react";

export type SiteType = "hospital" | "health_centers" | "admin_offices";

export interface ModuleDef {
  key: string;
  file: string;
  label: string;
  emoji: string;
  icon: LucideIcon;
  color: string;
  types: SiteType[];
}

export const ALL_MODULES: ModuleDef[] = [
  { key: "settings_main",              file: "settings_main.html",              label: "الإعدادات الرئيسية",         emoji: "⚙️",  icon: Settings,          color: "#2a5298", types: ["hospital", "health_centers", "admin_offices"] },
  { key: "settings_advanced",          file: "settings_advanced.html",          label: "الإعدادات المتقدمة",         emoji: "🔧",  icon: SlidersHorizontal, color: "#1e3c72", types: ["hospital", "health_centers", "admin_offices"] },
  { key: "attendance",                 file: "attendance.html",                 label: "الحضور والانصراف",           emoji: "📋",  icon: Clock,             color: "#0077b6", types: ["hospital"] },
  { key: "performance",                file: "performance.html",                label: "جداول الأداء",              emoji: "📊",  icon: BarChart2,         color: "#023e8a", types: ["hospital"] },
  { key: "achievement",                file: "achievement.html",                label: "شهادة الإنجاز",             emoji: "🏆",  icon: Trophy,            color: "#0096c7", types: ["hospital"] },
  { key: "consumables",                file: "consumables.html",                label: "مستخلص المستهلكات",         emoji: "🧪",  icon: Package,           color: "#0077b6", types: ["hospital"] },
  { key: "spare_parts",                file: "spare_parts.html",                label: "مستخلص قطع الغيار",         emoji: "🔩",  icon: Wrench,            color: "#023e8a", types: ["hospital"] },
  { key: "approval",                   file: "approval.html",                   label: "اعتماد المستخلص",           emoji: "✅",  icon: CheckSquare,       color: "#0096c7", types: ["hospital"] },
  { key: "monthly-overview",           file: "monthly-overview.html",           label: "النظرة الشاملة",            emoji: "📈",  icon: BarChart2,         color: "#1e3c72", types: ["hospital"] },
  { key: "request-visit",              file: "request-visit.html",              label: "تسجيل الزيارات",            emoji: "🏥",  icon: MapPin,            color: "#2a5298", types: ["hospital"] },
  { key: "health_centers_attendance",  file: "health_centers_attendance.html",  label: "المراكز — العمالة",         emoji: "👷",  icon: ClipboardList,     color: "#1e3c72", types: ["health_centers"] },
  { key: "health_centers_consumables", file: "health_centers_consumables.html", label: "المراكز — المستهلكات",      emoji: "🧪",  icon: Package,           color: "#0077b6", types: ["health_centers"] },
  { key: "admin_offices_attendance",   file: "admin_offices_attendance.html",   label: "المكاتب — العمالة",         emoji: "👷",  icon: ClipboardList,     color: "#2a5298", types: ["admin_offices"] },
  { key: "admin_offices_consumables",  file: "admin_offices_consumables.html",  label: "المكاتب — المستهلكات",      emoji: "🧪",  icon: Package,           color: "#0077b6", types: ["admin_offices"] },
  { key: "review_extract",             file: "review_extract.html",             label: "مراجعة المستخلص",           emoji: "🔍",  icon: Eye,               color: "#023e8a", types: ["hospital", "health_centers", "admin_offices"] },
  { key: "extract-archive",            file: "extract-archive.html",            label: "أرشيف المستخلصات",          emoji: "🗂️", icon: Archive,           color: "#1e3c72", types: ["hospital", "health_centers", "admin_offices"] },
];

export function getModuleKey(filename: string): string {
  return filename.replace(".html", "");
}

export function parseAllowedModules(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getSiteType(hospital: string | null | undefined): SiteType {
  if (!hospital) return "hospital";
  if (hospital === "المراكز الصحية") return "health_centers";
  if (hospital === "المكاتب الإدارية") return "admin_offices";
  return "hospital";
}

export function isModuleAllowed(
  moduleKey: string,
  allowedModuleKeys: string[] | null,
  role: string,
): boolean {
  if (role === "admin" || role === "supervisor") return true;
  if (allowedModuleKeys === null) return true;
  return allowedModuleKeys.includes(moduleKey);
}

export function filterModules(
  siteType: SiteType,
  allowedModuleKeys: string[] | null,
  role: string,
): ModuleDef[] {
  const isPrivileged = role === "admin" || role === "supervisor" || role === "contract_supervisor";
  const byType = isPrivileged
    ? ALL_MODULES
    : ALL_MODULES.filter(m => m.types.includes(siteType));
  if (allowedModuleKeys !== null && !isPrivileged) {
    const keySet = new Set(allowedModuleKeys);
    return byType.filter(m => keySet.has(m.key));
  }
  return byType;
}
