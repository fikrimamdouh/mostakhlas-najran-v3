import {
  Settings, SlidersHorizontal, Clock, BarChart2, Trophy, Package, Wrench,
  CheckSquare, MapPin, ClipboardList, Eye, Archive, BadgeCheck, Building2, type LucideIcon,
} from "lucide-react";

export type SiteType = "hospital" | "health_centers" | "admin_offices" | "najran_general";

export interface ModuleDef {
  key: string;
  file: string;
  label: string;
  emoji: string;
  icon: LucideIcon;
  color: string;
  types: SiteType[];
  adminOnly?: boolean;
  explicitOnly?: boolean;
}

export const VISIT_MODULE_KEYS = ["request-visit", "visit_review"];

export const ALL_MODULES: ModuleDef[] = [
  { key: "najran_general",              file: "najran_general.html",             label: "مستشفى نجران العام الجديد وطب الأسنان", emoji: "🏥", icon: Building2, color: "#1e3c72", types: ["najran_general"] },
  { key: "approval",                   file: "approval.html",                   label: "اعتماد المستخلص",           emoji: "✅",  icon: CheckSquare, color: "#15803d", types: [] },
  { key: "visit_review",               file: "visit-admin-review.html",         label: "مراجعة زيارات مقاولي الباطن", emoji: "🪪", icon: BadgeCheck, color: "#1e3c72", types: ["hospital"], explicitOnly: true },
  { key: "settings_main",              file: "settings_main.html",              label: "الإعدادات الرئيسية",         emoji: "⚙️",  icon: Settings, color: "#2a5298", types: ["hospital", "health_centers", "admin_offices"] },
  { key: "settings_advanced",          file: "settings_advanced.html",          label: "الإعدادات المتقدمة",         emoji: "🔧",  icon: SlidersHorizontal, color: "#1e3c72", types: ["hospital", "health_centers", "admin_offices"] },
  { key: "attendance",                 file: "attendance.html",                 label: "الحضور والانصراف",           emoji: "📋",  icon: Clock, color: "#0077b6", types: ["hospital"] },
  { key: "performance",                file: "performance.html",                label: "جداول الأداء",              emoji: "📊",  icon: BarChart2, color: "#023e8a", types: ["hospital"] },
  { key: "achievement",                file: "achievement.html",                label: "شهادة الإنجاز",             emoji: "🏆",  icon: Trophy, color: "#0096c7", types: ["hospital"] },
  { key: "consumables",                file: "consumables.html",                label: "مستخلص المستهلكات",         emoji: "🧪",  icon: Package, color: "#0077b6", types: ["hospital"] },
  { key: "spare_parts",                file: "spare_parts.html",                label: "مستخلص قطع الغيار",         emoji: "🔩",  icon: Wrench, color: "#023e8a", types: ["hospital"] },
  { key: "request-visit",              file: "request-visit.html",              label: "تسجيل الزيارات",            emoji: "🏥",  icon: MapPin, color: "#2a5298", types: ["hospital"], explicitOnly: true },
  { key: "health_centers_attendance",  file: "health_centers_attendance.html",  label: "المراكز — العمالة",         emoji: "👷",  icon: ClipboardList, color: "#1e3c72", types: ["health_centers"] },
  { key: "health_centers_consumables", file: "health_centers_consumables.html", label: "المراكز — المستهلكات",      emoji: "🧪",  icon: Package, color: "#0077b6", types: ["health_centers"] },
  { key: "admin_offices_attendance",   file: "admin_offices_attendance.html",   label: "المكاتب — العمالة",         emoji: "👷",  icon: ClipboardList, color: "#2a5298", types: ["admin_offices"] },
  { key: "admin_offices_consumables",  file: "admin_offices_consumables.html",  label: "المكاتب — المستهلكات",      emoji: "🧪",  icon: Package, color: "#0077b6", types: ["admin_offices"] },
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
  if (
    hospital === "مستشفى نجران العام الجديد" ||
    hospital === "مركز طب الأسنان التخصصي" ||
    hospital === "مستشفى نجران العام الجديد ومركز طب الأسنان التخصصي"
  ) return "najran_general";
  if (hospital === "المراكز الصحية" || hospital === "المراكز الصحية (مجمع)") return "health_centers";
  if (hospital === "المكاتب الإدارية" || hospital === "المكاتب الإدارية والمرافق الصحية") return "admin_offices";
  return "hospital";
}

const COMPANY_SITE_TYPES: Record<string, SiteType[]> = {
  "بيت_العرب": ["hospital", "admin_offices"],
  "سراكو": ["hospital", "health_centers"],
  "تجمع_نجران": [],
};

export function getCompanySiteTypes(company: string | null | undefined): SiteType[] | null {
  if (!company) return null;
  return COMPANY_SITE_TYPES[company] ?? null;
}

export function isModuleAllowed(moduleKey: string, allowedModuleKeys: string[] | null, role: string): boolean {
  if (role === "admin" || role === "supervisor") return true;
  if (allowedModuleKeys === null) return !VISIT_MODULE_KEYS.includes(moduleKey);
  return allowedModuleKeys.includes(moduleKey);
}

export const ASSIGNABLE_MODULES = ALL_MODULES.filter(m => !m.adminOnly);

export function filterModules(siteType: SiteType, allowedModuleKeys: string[] | null, role: string, company?: string | null): ModuleDef[] {
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";
  const isPrivileged = isAdmin || isSupervisor || role === "contract_supervisor";
  let byType: ModuleDef[];

  if (isAdmin) {
    byType = ALL_MODULES;
  } else if (isSupervisor) {
    const companySiteTypes = getCompanySiteTypes(company);
    if (companySiteTypes && companySiteTypes.length > 0) {
      const typeSet = new Set(companySiteTypes);
      byType = ALL_MODULES.filter(m => !m.adminOnly && m.types.some(t => typeSet.has(t)));
    } else {
      byType = ALL_MODULES.filter(m => !m.adminOnly);
    }
  } else if (isPrivileged) {
    byType = ALL_MODULES.filter(m => !m.adminOnly);
  } else {
    byType = ALL_MODULES.filter(m => !m.adminOnly && m.types.includes(siteType));
  }

  if (allowedModuleKeys !== null) {
    const keySet = new Set(allowedModuleKeys);
    const filtered = byType.filter(m => keySet.has(m.key));
    if (!isPrivileged && filtered.length === 0 && allowedModuleKeys.length > 0) return byType.filter(m => !m.explicitOnly);
    return filtered;
  }

  return byType.filter(m => !m.explicitOnly);
}
