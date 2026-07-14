import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import {
  db,
  usersTable,
  visitRequestsTable,
  systemSettingsTable,
  visitSystemsTable,
  visitContractorsTable,
  visitQualificationsTable,
  visitSiteApprovalsTable,
  visitRepresentativesTable,
  visitRepresentativeSystemsTable,
  visitRequestMetadataTable,
  visitDocumentsTable,
  visitDocumentContentsTable,
  visitNumberSequencesTable,
  visitPermitTokensTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";
import { requireClusterVisitManagement } from "../middleware/requireClusterVisitManagement";
import { findCurrentUser } from "../lib/current-user";
import { logAudit } from "./audit";
import {
  createPermitToken,
  decryptPermitToken,
  detectVisitFile,
  hasClusterVisitManagement,
  isDateWithin,
  isValidSaudiMobile,
  maskIdentity,
  MAX_VISIT_DOCUMENT_BYTES,
  MAX_VISIT_ZIP_BYTES,
  parseIsoDate,
  sanitizeFilename,
  sha256,
  shortenVisitorName,
  tokenHashesMatch,
  validateVisitWindow,
  validateZipEntries,
  visitEffectiveStatus,
} from "../lib/visit-security";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { sendVisitApprovedEmail, sendVisitNewRequestEmail, sendVisitRejectedEmail } from "../lib/email";

const ADMIN_EMAIL = "rorofikri@gmail.com";
const router = Router();

const DEFAULT_VISIT_SIGNER_TITLE = "مشرف وحدة الصيانة العامة";
const DEFAULT_VISIT_SIGNER_NAME = "م. محمد عباس المكرمي";
const DEFAULT_VISIT_PURPOSE = "زيارة دورية لأنظمة المستشفى";
const MAX_VISIT_PRINT_ASSET_BYTES = 2 * 1024 * 1024;
const APPROVED_CATALOG_SOURCE = "مستورد من كتالوج مقاولي الباطن المعتمدين";
const MAINTENANCE_CONTRACTORS = [
  {
    key: "بيت_العرب",
    name: "شركة مجموعة بيت العرب الحديثة المحدودة",
    sites: [
      "مستشفى يدمه العام",
      "مستشفى حبونا العام",
      "مستشفى بدر الجنوب العام",
      "مستشفى الولادة والأطفال",
      "مستشفى غرب نجران للولادة والأطفال والعيادات التخصصية",
      "المكاتب الإدارية والمرافق الصحية وصيانة وإصلاح السيارات والعيادات المتنقلة",
    ],
  },
  {
    key: "سراكو",
    name: "شركة سراكو",
    sites: [
      "مستشفى نجران العام الجديد",
      "مركز طب الأسنان التخصصي",
      "مجمع الأمل للصحة النفسية",
      "مستشفى ثار العام",
      "مستشفى خباش العام",
      "المراكز الصحية",
      "مستشفى الملك خالد",
      "مركز الأمير سلطان",
      "مستشفى شروره العام",
    ],
  },
] as const;

const SYSTEM_CANONICAL_NAMES = [
  { name: "تعقيم ونظافة مجاري الهواء والدكتات", aliases: ["تنظيف مجاري الهواء", "صيانة ونظافة مجارى الهواء والدكتات (زيارة واحدة مدة العقد)", "صيانة ونظافة مجاري الهواء والدكتات (زيارة واحدة مدة العقد)"] },
  { name: "صيانة أنظمة التكييف والتبريد وأنظمة التهوية", aliases: ["التكييف والتبريد", "صيانة انظمة التكيف والتبريد وانظمة التهوية وملحقاتها", "صيانة أنظمة التكييف والتبريد وأنظمة التهوية وملحقاتها"] },
  { name: "صيانة المصاعد الكهربائية", aliases: ["المصاعد", "المصاعد الكهربائية"] },
  { name: "صيانة وإصلاح نظام إطفاء الحريق", aliases: ["إطفاء الحريق", "اطفاء الحريق", "صيانة واصلاح نظام اطفاء الحريق"] },
  { name: "صيانة وإصلاح نظام إنذار الحريق", aliases: ["إنذار الحريق", "انذار الحريق", "صيانة واصلاح نظام انذار الحريق"] },
  { name: "صيانة السنترالات والنداء الآلي والإذاعة الداخلية والساعة المركزية واستدعاء الممرضات", aliases: ["السنترال والنداء واستدعاء الممرضات", "صيانة واصلاح السنترالات والنداء الالى والاذاعة الداخلية والساعة المركزية واستدعاء الممرضات"] },
  { name: "صيانة محطات التوليد الكهربائية ولوحات التحكم والتشغيل و(ATS)", aliases: ["المولدات الكهربائية وأنظمة التحويل الآلي (ATS)", "المولدات الكهربائية وATS", "صيانة محطات التوليد الكهربائية (مولدات الطوارى) ولوحات التحكم والتشغيل والـ ATS"] },
  { name: "صيانة شبكة الغازات الطبية وملحقاتها وخزانات الغاز", aliases: ["الغازات الطبية"] },
  { name: "صيانة الـ (UPS)", aliases: ["UPS", "أنظمة مزودات الطاقة غير المنقطعة (UPS)", "صيانة جهاز UPS"] },
  { name: "صيانة محولات الكهرباء والقواطع الكهربائية وكامل اللوحات الكهربائية", aliases: ["المحولات واللوحات والقواطع الكهربائية"] },
  { name: "صيانة معدات المغسلة", aliases: ["المغاسل", "معدات المغسلة"] },
  { name: "صيانة محطات تحلية مياه الشرب وملحقاتها", aliases: ["محطات تحلية المياه", "محطات تحلية مياه الشرب"] },
  { name: "صيانة محطة معالجة مياه الصرف الصحي", aliases: ["محطات معالجة مياه الصرف الصحي", "صيانة محطة معالجة مياه الصرف الصحى"] },
  { name: "مكافحة الحشرات والقوارض والآفات البيئية", aliases: ["مكافحة الحشرات", "مكافحة الحشرات والقوارض والافات البيئية"] },
  { name: "صيانة ثلاجة الموتى", aliases: ["ثلاجة الموتى"] },
  { name: "صيانة نظم المراقبات الأمنية", aliases: ["نظام كاميرات المراقبة الأمنية (CCTV)", "كاميرات المراقبة الأمنية CCTV", "نظم المراقبات الأمنية", "صيانة نظم المراقبات الامنية"] },
  { name: "عمرات المولدات", aliases: [] },
] as const;

const CONTRACTOR_CANONICAL_NAMES = [
  { name: "مؤسسة أفق الحجاز المحدودة", aliases: ["أفق الحجاز"] },
  { name: "شركة المفردون للمقاولات", aliases: ["المفردون"] },
  { name: "شركة إيكوفا للمقاولات", aliases: ["شركة إيكوفا", "إيكوفا للمقاولات"] },
  { name: "شركة دائرة التحكم", aliases: [] },
  { name: "شركة الركن السليم للسلامة", aliases: ["الركن السليم"] },
  { name: "الشركة العربية للتشغيل والصيانة", aliases: ["الشركة العربية"] },
  { name: "شركة السامي للأمن والسلامة", aliases: ["شركة السامي للأمن"] },
  { name: "شركة النسر الفضي للمقاولات", aliases: ["النسر الفضي"] },
  { name: "شركة قمم شار للمقاولات", aliases: ["قمم شار"] },
  { name: "مؤسسة نبراس حنين لأنظمة السلامة", aliases: ["نبراس حنين"] },
  { name: "شركة صفوق الريادة للمقاولات العامة", aliases: ["صفوق الريادة", "صفوف الريادة"] },
  { name: "شركة سايت تكنولوجي العربية السعودية", aliases: ["سايت تكنولوجي"] },
  { name: "مؤسسة أسس التطوير للمقاولات", aliases: ["أسس التطوير للمقاولات"] },
  { name: "مؤسسة المتألق البيئي", aliases: ["مؤسسة التألق البيئي", "المتألق البيئي"] },
  { name: "مؤسسة ماسة لمكافحة الحشرات للمبيدات الزراعية", aliases: ["مؤسسة ماسة الحشرات", "مؤسسة ماسة مكافحة الحشرات للمبيدات الزراعية"] },
  { name: "مؤسسة خالد عايض الجعيدي الدوسري للمقاولات", aliases: ["خالد عايض الجعيدي"] },
  { name: "شركة دائرة الأنظمة للتجارة", aliases: [] },
  { name: "مؤسسة شلالات النسيم للأعمال الكهرو ميكانيكية", aliases: [] },
  { name: "شركة العالمية للصناعات الحديثة", aliases: [] },
  { name: "شركة فوج السعودية للمصاعد والسلالم", aliases: [] },
  { name: "شركة ميتسوبيشي الكهربائية المحدودة", aliases: [] },
  { name: "مؤسسة ماس السعودية للمقاولات", aliases: [] },
  { name: "تى كية اليفيتور العربية السعودية المحدودة", aliases: [] },
  { name: "شركة شيندلر العليان للمصاعد المحدودة", aliases: [] },
  { name: "شركة مصنع الغماس للصناعات الكهروميكانيكية المتطور", aliases: [] },
] as const;

// Snapshot of the approved-subcontractor folders supplied by the maintenance
// unit. Names shown to users are canonical and complete; aliases are retained
// only to attach existing database rows and historical visits without loss.
const APPROVED_SUBCONTRACTOR_CATALOG = [
  { system: "تعقيم ونظافة مجاري الهواء والدكتات", contractors: ["كيان التزويد", "مصداقية وطن", "شركة آراك الخليج", "بريق الجليد"] },
  { system: "صيانة أنظمة التكييف والتبريد وأنظمة التهوية", contractors: ["إلهامات الحديثة", "شركة رياح النواة", "شركة وتين", "مصداقية الوطن", "شركة أهالينا", "شنان الخليج"] },
  { system: "صيانة المصاعد الكهربائية", contractors: [] },
  { system: "صيانة وإصلاح نظام إطفاء الحريق", contractors: ["مؤسسة أجهزة الإطفاء لأجهزة السلامة", "شركة الركن السليم للسلامة", "الشركة العربية للتشغيل والصيانة", "شركة دائرة التحكم", "شركة إيكوفا للمقاولات", "مؤسسة أفق الحجاز المحدودة", "مؤسسة نبراس حنين لأنظمة السلامة", "شركة قمم شار للمقاولات", "شركة المفردون للمقاولات", "شركة النسر الفضي للمقاولات"] },
  { system: "صيانة وإصلاح نظام إنذار الحريق", contractors: ["شركة النسر الفضي للمقاولات", "مؤسسة أشواق الجنوب", "مؤسسة أجهزة الإطفاء لأجهزة السلامة", "شركة السامي للأمن والسلامة", "شركة الركن السليم للسلامة", "شركة دائرة التحكم", "شركة إيكوفا للمقاولات", "مؤسسة أفق الحجاز المحدودة", "شركة المفردون للمقاولات", "مؤسسة نبراس حنين لأنظمة السلامة", "شركة قمم شار للمقاولات"] },
  { system: "صيانة السنترالات والنداء الآلي والإذاعة الداخلية والساعة المركزية واستدعاء الممرضات", contractors: ["دار المبتكر", "سايت تكنولوجي", "مؤسسة أشواق الجنوب", "شركة إيكوفا", "نبراس حنين"] },
  { system: "صيانة محطات التوليد الكهربائية ولوحات التحكم والتشغيل و(ATS)", contractors: ["سبق التقنية", "الصدارة", "سايت تكنولوجي", "صفوف الريادة", "شركة النسر الفضي للمقاولات", "شركة الأمان الحديثة للطاقة", "المرافق"] },
  { system: "صيانة شبكة الغازات الطبية وملحقاتها وخزانات الغاز", contractors: ["النظم الاحترافية", "شركة ماس", "سيسنبر العالمية", "أهالينا", "دريجر", "شركة مودرن تشالنجر"] },
  { system: "صيانة الـ (UPS)", contractors: ["الصدارة", "رواد الأمانة", "سايت تكنولوجي", "شركة النسر الفضي للمقاولات", "شركة إيكوفا للمقاولات", "شركة الأمان الحديثة للطاقة", "المرافق"] },
  { system: "صيانة محولات الكهرباء والقواطع الكهربائية وكامل اللوحات الكهربائية", contractors: ["الصدارة", "سبق التقنية", "سايت تكنولوجي", "صفوف الريادة", "المرافق", "شركة الأمان الحديثة للطاقة", "شركة النسر الفضي للمقاولات"] },
  { system: "صيانة معدات المغسلة", contractors: ["مصنع الجعيدي"] },
  { system: "صيانة محطات تحلية مياه الشرب وملحقاتها", contractors: ["أسس التطوير للمقاولات", "تبرا العالمية"] },
  { system: "صيانة محطة معالجة مياه الصرف الصحي", contractors: ["أسس التطوير للمقاولات"] },
  { system: "مكافحة الحشرات والقوارض والآفات البيئية", contractors: ["مستقبل الأوطان للتشغيل", "شركة تراب كيل", "مؤسسة ماسة الحشرات", "شركة الإيوان الطبية", "مؤسسة التألق البيئي", "شركة حنين للمقاولات", "مكسل", "سادن", "رسيل الشرق", "درة الفتاك"] },
  { system: "صيانة ثلاجة الموتى", contractors: ["شركة رياح النواة", "شنان الخليج"] },
  { system: "صيانة نظم المراقبات الأمنية", contractors: ["سايت تكنولوجي", "الأفق المتميزة", "مؤسسة أشواق الجنوب", "دروع الأمنية", "مؤسسة نبراس حنين لأنظمة السلامة"] },
  { system: "عمرات المولدات", contractors: [] },
] as const;

// These names and validity dates are transcribed from the supplied Ministry of
// Health qualification certificates. Identity numbers are intentionally not
// copied into source code or listing APIs. A manager completes identity,
// mobile, and residence data before a listed person becomes selectable.
const QUALIFICATION_CERTIFICATES = [
  { reference: "MOH-MAIN-2026-023", company: "مؤسسة أفق الحجاز المحدودة", system: "إطفاء الحريق", validFrom: "2026-05-17", validUntil: "2027-12-31", contactMobile: "0535588407", personnel: ["أحمد محمد أبو اليزيد", "فيصل فهد البري", "عتيق محمد عتيق الحارثي", "محمود إيهاب حمود", "سيول نذر السلام", "محمود السيد محمد إبراهيم", "عبدالعزيز مسعود ضيف الله", "محمد محمد أحمد إبراهيم", "شهيد الرحمن مفيض"] },
  { reference: "MOH-MAIN-2026-024", company: "مؤسسة أفق الحجاز المحدودة", system: "إنذار الحريق", validFrom: "2026-05-17", validUntil: "2027-12-31", contactMobile: "0535588407", personnel: ["نثار خليفة عثمان العمودي", "ثابت محمد ثابت الشهري", "سعد سلطان الحكمي", "مد الرز", "يحي محمد سعيد صقر", "يوسف عبيد عبدالله الجدعاني", "محمد حسن علي قحل", "علي أحمد المقري", "أبو الحسن نور السلام"] },
  { reference: "MOH-MAIN-2026-027", company: "شركة المفردون للمقاولات", system: "إنذار الحريق", validFrom: "2026-05-20", validUntil: "2027-12-31", contactMobile: "0542197396", personnel: ["بلقر شعبان رمضان", "إبراهيم سلمي عمارة", "محمد منور علي"] },
  { reference: "MOH-MAIN-2026-028", company: "شركة المفردون للمقاولات", system: "إطفاء الحريق", validFrom: "2026-05-20", validUntil: "2027-12-31", contactMobile: "0542197396", personnel: ["خالد حسين أحمد", "ربيع شعبان عبدالعليم", "محمد السيد عزوز"] },
  { reference: "MOH-MAIN-2026-029", company: "شركة إيكوفا للمقاولات", system: "إنذار الحريق", validFrom: "2026-05-20", validUntil: "2027-12-31", contactMobile: "0539668455", personnel: ["فوزي السيد فايد", "جوزيف أورتيز", "أحمد فتحي محمد"] },
  { reference: "MOH-MAIN-2026-043", company: "شركة إيكوفا للمقاولات", system: "إطفاء الحريق", validFrom: "2026-06-20", validUntil: "2027-12-31", contactMobile: "0582224263", personnel: ["مجيحت عنتر رجب", "محمد حسن الخنجور", "زياد عماد عبدالمنور"] },
  { reference: "MOH-MAIN-2026-046", company: "شركة دائرة التحكم", system: "إطفاء الحريق", validFrom: "2026-06-20", validUntil: "2027-12-31", contactMobile: "0505139763", personnel: ["موسى إقبال", "محمد مأمون مياه", "بسام ربيع فكري"] },
  { reference: "MOH-MAIN-2026-047", company: "شركة دائرة التحكم", system: "إنذار الحريق", validFrom: "2026-06-20", validUntil: "2027-12-31", contactMobile: "0505139763", personnel: ["شكيل ملا", "مد عمران", "سهريب مرسلين"] },
  { reference: "MOH-MAIN-2026-050", company: "شركة الركن السليم للسلامة", system: "إطفاء الحريق", validFrom: "2026-06-22", validUntil: "2027-12-31", contactMobile: "0503820195", personnel: ["عامر محمود الشراونه", "محمد أحمد نور داوود", "محمود داوود", "أحمد نور محمد داوود", "شاه فيصل مير عبدالرحمن", "عمار ماهر عبدالمجيد المنصور", "هاشم أحمد نور محمد داوود", "درويش محمد"] },
  { reference: "MOH-MAIN-2026-051", company: "الشركة العربية للتشغيل والصيانة", system: "إطفاء الحريق", validFrom: "2026-05-10", validUntil: "2027-12-31", contactMobile: "0557889797", personnel: ["جيلاني عبدالله الجيلاني محمد الحسن", "إبراهيم علي عبدالرحمن عبدالله", "عماد الدين التاج بكري الشيخ"] },
  { reference: "MOH-MAIN-2026-052", company: "شركة الركن السليم للسلامة", system: "إنذار الحريق", validFrom: "2026-06-22", validUntil: "2027-12-31", contactMobile: "0503820195", personnel: ["إبراهيم عبد الفتاح مصطفى ثابت", "سونو سونو الأنصاري سلك", "أكبر علي كينال ميان", "وليد محمد أمين صديق تركستاني", "وليد أرشد محمد أرشد", "عبدالعزيز محمود محمد المدني"] },
  { reference: "MOH-MAIN-2026-054", company: "شركة السامي للأمن والسلامة", system: "إنذار الحريق", validFrom: "2026-06-24", validUntil: "2027-12-31", contactMobile: "0550535225", personnel: ["أحمد نجاح أبو رفاعي", "حيدر شكر الله أحمد", "سعد محمد رمضان"] },
  { reference: "MOH-MAIN-2026-015", company: "شركة النسر الفضي للمقاولات", system: "إطفاء الحريق", validFrom: "2026-05-17", validUntil: "2027-12-31", contactMobile: "0560007092", personnel: ["عبدالعزيز عبدالله الزهراني", "سلطان طيب القيسي", "محمد قاسم محمد"] },
  { reference: "MOH-MAIN-2026-013", company: "شركة النسر الفضي للمقاولات", system: "إنذار الحريق", validFrom: "2026-05-17", validUntil: "2027-12-31", contactMobile: "0560007092", personnel: ["مشاري مطلق العطوي", "ثريا مفضي العنزي", "محمد عارف"] },
  { reference: "MOH-MAIN-2026-009", company: "شركة قمم شار للمقاولات", system: "إطفاء الحريق", validFrom: "2026-05-17", validUntil: "2027-12-31", contactMobile: "0580615950", personnel: ["أحمد فرج طعيمة", "جابر محمد خليل", "عبدالرحمن ظافر العنزي"] },
  { reference: "MOH-MAIN-2026-010", company: "شركة قمم شار للمقاولات", system: "إنذار الحريق", validFrom: "2026-05-17", validUntil: "2027-12-31", contactMobile: "0580615950", personnel: ["السيد إبراهيم ناصف", "رضى محي الدين الشريني", "حمدي عوف هارون"] },
  { reference: "MOH-MAIN-2026-018", company: "مؤسسة نبراس حنين لأنظمة السلامة", system: "إطفاء الحريق", validFrom: "2026-05-17", validUntil: "2027-12-31", contactMobile: "0536893723", personnel: ["يحي محمد العنزي", "يوسف أحمد يوسف القاري", "عبدالإله نايف القحطاني"] },
  { reference: "MOH-MAIN-2026-017", company: "مؤسسة نبراس حنين لأنظمة السلامة", system: "إنذار الحريق", validFrom: "2026-05-17", validUntil: "2027-12-31", contactMobile: "0536893723", personnel: ["مشاري عبدالله العنزي", "راكان حامد عواد الزارع", "عبدالله عبدالكريم القازح"] },
] as const;

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VISIT_DOCUMENT_BYTES, files: 1 },
});
const zipUploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VISIT_ZIP_BYTES, files: 1 },
});
const legacyDocxUploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 40 },
});

type AnyDb = typeof db | any;
type VisitContext = {
  visit: any;
  metadata: any | null;
  system: any | null;
  contractor: any | null;
  representative: any | null;
  siteApproval: any | null;
  qualification: any | null;
};

const zipPreviews = new Map<string, { expiresAt: number; sha: string; records: Record<string, any[]>; entries: string[]; uploadedBy: number }>();
type LegacyRepresentativeRecord = { sourceFile: string; fullName: string; identityNumber: string; mobile: string; companyName: string; suggestedSystemName: string | null };
const legacyRepresentativePreviews = new Map<string, { expiresAt: number; uploadedBy: number; records: LegacyRepresentativeRecord[] }>();
const scanRate = new Map<string, number[]>();

function clientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function assertScanRate(req: any, res: any): boolean {
  const key = `${req.currentUser?.id || "anon"}:${clientIp(req)}`;
  const now = Date.now();
  const recent = (scanRate.get(key) || []).filter((at) => now - at < 60_000);
  if (recent.length >= 30) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "تم تجاوز عدد محاولات التحقق المسموح؛ حاول بعد دقيقة" });
    return false;
  }
  recent.push(now);
  scanRate.set(key, recent);
  if (scanRate.size > 2_000) {
    for (const [candidate, times] of scanRate) if (!times.some((at) => now - at < 60_000)) scanRate.delete(candidate);
  }
  return true;
}

async function requireApproved(req: any, res: any, next: any) {
  const user = await findCurrentUser(req);
  if (!user) return res.status(401).json({ error: "المستخدم غير مسجل" });
  if (user.status !== "approved") return res.status(403).json({ error: "الحساب غير معتمد" });
  req.currentUser = user;
  return next();
}

function audit(req: any, action: string, details: Record<string, unknown>) {
  const user = req.currentUser;
  return logAudit(user?.id ?? null, user?.email ?? null, user?.name ?? null, action, JSON.stringify(details), clientIp(req));
}

function cleanText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function catalogNameKey(value: unknown): string {
  return cleanText(value, 250)
    .normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function canonicalName(value: unknown, rows: readonly { name: string; aliases: readonly string[] }[]): string {
  const raw = cleanText(value, 250);
  const key = catalogNameKey(raw);
  const match = rows.find((row) => catalogNameKey(row.name) === key || row.aliases.some((alias) => catalogNameKey(alias) === key));
  return match?.name || raw;
}

function canonicalSystemName(value: unknown): string {
  return canonicalName(value, SYSTEM_CANONICAL_NAMES);
}

function canonicalContractorName(value: unknown): string {
  return canonicalName(value, CONTRACTOR_CANONICAL_NAMES);
}

function isFullCompanyName(value: unknown): boolean {
  return /^(?:شركة|مؤسسة|مصنع)\s+\S+(?:\s+\S+)+$/u.test(cleanText(value, 200));
}

function validDateRange(fromValue: unknown, untilValue: unknown): { validFrom: string; validUntil: string } | null {
  const validFrom = dayString(fromValue), validUntil = dayString(untilValue);
  if (!validFrom || !validUntil || validUntil < validFrom) return null;
  return { validFrom, validUntil };
}

function databaseErrorCode(err: any): string {
  return String(err?.code || err?.cause?.code || "");
}

function respondVisitMutationError(req: any, res: any, err: any, fallbackMessage: string, duplicateMessage?: string) {
  const code = databaseErrorCode(err);
  if (code === "42P01" || code === "42703") {
    req.log.error({ err, code }, "Visit database schema is outdated");
    return res.status(503).json({
      error: "قاعدة بيانات الزيارات تحتاج إلى تطبيق آخر تحديث للمخطط ثم إعادة المحاولة",
      code: "VISIT_SCHEMA_OUTDATED",
    });
  }
  if (code === "23503") {
    return res.status(409).json({ error: "تعذر الربط لأن الشركة أو النظام لم يعد متاحًا؛ حدّث الصفحة ثم أعد الاختيار", code: "VISIT_REFERENCE_CHANGED" });
  }
  if (code === "23505" || String(err?.message).toLocaleLowerCase().includes("unique")) {
    return res.status(409).json({ error: duplicateMessage || "البيانات مسجلة من قبل", code: "VISIT_DUPLICATE" });
  }
  req.log.error({ err, code }, "Visit mutation failed");
  return res.status(500).json({ error: fallbackMessage, code: "VISIT_SAVE_FAILED" });
}

type RepresentativeInput = {
  contractorId: number;
  fullName: string;
  identityNumber: string;
  mobile: string;
  residenceExpiresAt: string | null;
  noResidenceException: boolean;
  exceptionReason: string | null;
};

async function upsertRepresentative(tx: AnyDb, input: RepresentativeInput) {
  const [existing] = await tx.select({ id: visitRepresentativesTable.id }).from(visitRepresentativesTable)
    .where(eq(visitRepresentativesTable.identityNumber, input.identityNumber)).limit(1);
  const [row] = await tx.insert(visitRepresentativesTable).values({
    contractorId: input.contractorId,
    fullName: input.fullName,
    identityNumber: input.identityNumber,
    mobile: input.mobile,
    residenceExpiresAt: input.noResidenceException ? null : input.residenceExpiresAt,
    noResidenceException: input.noResidenceException,
    exceptionReason: input.noResidenceException ? input.exceptionReason : null,
    isActive: true,
  }).onConflictDoUpdate({
    target: visitRepresentativesTable.identityNumber,
    set: {
      fullName: input.fullName,
      mobile: input.mobile,
      residenceExpiresAt: input.noResidenceException ? null : input.residenceExpiresAt,
      noResidenceException: input.noResidenceException,
      exceptionReason: input.noResidenceException ? input.exceptionReason : null,
      isActive: true,
      updatedAt: new Date(),
    },
  }).returning();
  if (row.contractorId !== input.contractorId) throw new Error("IDENTITY_BELONGS_TO_OTHER_CONTRACTOR");
  return { row, created: !existing };
}

function decodeWordXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function wordCellText(xml: string): string {
  const currentXml = xml.replace(/<w:(?:del|moveFrom)\b[\s\S]*?<\/w:(?:del|moveFrom)>/g, "");
  return [...currentXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeWordXml(match[1]))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function suggestedLegacySystem(companyName: string): string | null {
  if (/(?:مصاعد|اليفيتور|ميتسوبيشي|شيندلر|فوج)/u.test(companyName)) return "صيانة المصاعد الكهربائية";
  if (/(?:حشرات|البيئي)/u.test(companyName)) return "مكافحة الحشرات والقوارض والافات البيئية";
  if (/ماس السعودية/u.test(companyName)) return "صيانة شبكة الغازات الطبية وملحقاتها وخزانات الغاز";
  return null;
}

function parseLegacyRepresentativeDocx(file: Express.Multer.File): LegacyRepresentativeRecord[] {
  if (!file.originalname.toLocaleLowerCase().endsWith(".docx") || file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
    throw new Error("الملف ليس مستند Word DOCX حقيقيًا");
  }
  const zip = new AdmZip(file.buffer);
  const entries = zip.getEntries();
  validateZipEntries(entries);
  const documentEntry = entries.find((entry) => entry.entryName === "word/document.xml" && !entry.isDirectory);
  if (!documentEntry || Number(documentEntry.header?.size || 0) > 3 * 1024 * 1024) throw new Error("بنية مستند Word غير صالحة أو كبيرة بصورة غير آمنة");
  const xml = documentEntry.getData().toString("utf8");
  const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((rowMatch) =>
    [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cellMatch) => wordCellText(cellMatch[0])),
  );
  const identityRowIndex = rows.findIndex((row) => row.some((cell) => /رقم الهوية|الإقامة/u.test(cell)));
  const mobileRowIndex = rows.findIndex((row) => row.some((cell) => /رقم الجوال/u.test(cell)));
  const companyRow = rows.find((row) => row.some((cell) => /مقاول الباطن/u.test(cell))) || [];
  const companyName = canonicalContractorName(companyRow.find((cell) => cell && !/مقاول الباطن/u.test(cell)) || "");
  const mobile = rows.flat().flatMap((cell) => cell.match(/05\d{8}/g) || [])[0] || "";
  const identityCells = rows.slice(Math.max(0, identityRowIndex), mobileRowIndex > identityRowIndex ? mobileRowIndex : undefined).flat();
  const identities = identityCells.flatMap((cell) => cell.match(/\b[12]\d{9}\b/g) || []);
  const nameHeaderRow = rows.find((row) => row.some((cell) => /^الاسم$/u.test(cell.trim()))) || [];
  const nameLabelIndex = nameHeaderRow.findIndex((cell) => /^الاسم$/u.test(cell.trim()));
  const nameColumnIndex = nameLabelIndex > 0 ? nameLabelIndex - 1 : 1;
  const nameRows = identityRowIndex > 0 ? rows.slice(0, identityRowIndex) : rows.slice(0, 2);
  const names = nameRows.map((row) => cleanText(row[nameColumnIndex], 200)).filter((cell) => cell && /[\p{L}]/u.test(cell) && !/(?:الموقع|الاسم|تاريخ الزيارة|النظام)/u.test(cell));
  if (!companyName || !mobile || !names.length || names.length !== identities.length) {
    throw new Error("تعذر مطابقة الاسم والهوية والجوال واسم الشركة داخل المستند");
  }
  return names.map((fullName, index) => ({
    sourceFile: sanitizeFilename(file.originalname),
    fullName: cleanText(fullName, 200),
    identityNumber: identities[index],
    mobile,
    companyName,
    suggestedSystemName: suggestedLegacySystem(companyName),
  }));
}

function maintenanceContractor(key: unknown) {
  const normalized = cleanText(key, 80);
  return MAINTENANCE_CONTRACTORS.find((row) => row.key === normalized) || null;
}

function normalizedPrintAsset(value: unknown): string {
  if (value === undefined) throw new Error("PRINT_ASSET_UNDEFINED");
  if (value === null || value === "") return "";
  const raw = String(value);
  const match = raw.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("PRINT_ASSET_FORMAT");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_VISIT_PRINT_ASSET_BYTES) throw new Error("PRINT_ASSET_SIZE");
  const detected = detectVisitFile(buffer);
  if (!detected || detected.mimeType === "application/pdf" || detected.mimeType !== match[1]) throw new Error("PRINT_ASSET_MAGIC");
  return `data:${detected.mimeType};base64,${buffer.toString("base64")}`;
}

function numberId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function dayString(value: unknown): string | null {
  const date = parseIsoDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function sanitizeVisit(visit: any, metadata?: any | null) {
  return {
    id: visit.id,
    repName: visit.repName,
    repIdMasked: maskIdentity(visit.repId),
    siteLocation: visit.siteLocation,
    visitDate: visit.visitDate,
    systemName: canonicalSystemName(visit.systemName),
    mainContractor: visit.mainContractor,
    subContractor: canonicalContractorName(visit.subContractor),
    status: visit.status,
    effectiveStatus: visitEffectiveStatus(visit, metadata),
    adminNotes: visit.adminNotes,
    serialNumber: visit.serialNumber,
    approvedAt: visit.approvedAt,
    cancelledAt: visit.cancelledAt,
    cancelledReason: visit.cancelledReason,
    reissuedFromVisitId: visit.reissuedFromVisitId,
    purpose: metadata?.purpose || null,
    startsAt: metadata?.startsAt || null,
    endsAt: metadata?.endsAt || null,
    hasSignedPermit: !!visit.signedPermitFile,
    createdAt: visit.createdAt,
    updatedAt: visit.updatedAt,
  };
}

async function getSetting(key: string, executor: AnyDb = db): Promise<string | null> {
  const [row] = await executor.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string, updatedBy: string) {
  await db.insert(systemSettingsTable).values({ key, value, updatedBy })
    .onConflictDoUpdate({ target: systemSettingsTable.key, set: { value, updatedAt: new Date(), updatedBy } });
}

async function getVisitContext(executor: AnyDb, visitId: number): Promise<VisitContext | null> {
  const [row] = await executor.select({
    visit: visitRequestsTable,
    metadata: visitRequestMetadataTable,
    system: visitSystemsTable,
    contractor: visitContractorsTable,
    representative: visitRepresentativesTable,
    siteApproval: visitSiteApprovalsTable,
    qualification: visitQualificationsTable,
  })
    .from(visitRequestsTable)
    .leftJoin(visitRequestMetadataTable, eq(visitRequestMetadataTable.visitId, visitRequestsTable.id))
    .leftJoin(visitSystemsTable, eq(visitSystemsTable.id, visitRequestMetadataTable.systemId))
    .leftJoin(visitContractorsTable, eq(visitContractorsTable.id, visitRequestMetadataTable.contractorId))
    .leftJoin(visitRepresentativesTable, eq(visitRepresentativesTable.id, visitRequestMetadataTable.representativeId))
    .leftJoin(visitSiteApprovalsTable, eq(visitSiteApprovalsTable.id, visitRequestMetadataTable.siteApprovalId))
    .leftJoin(visitQualificationsTable, eq(visitQualificationsTable.id, visitRequestMetadataTable.qualificationId))
    .where(eq(visitRequestsTable.id, visitId))
    .limit(1);
  return row || null;
}

function snapshotFor(context: VisitContext) {
  const { visit, metadata, system, contractor, representative, siteApproval, qualification } = context;
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    purpose: metadata?.purpose || "",
    visit: {
      repName: visit.repName,
      repIdMasked: maskIdentity(visit.repId),
      siteLocation: visit.siteLocation,
      visitDate: visit.visitDate,
      startsAt: metadata?.startsAt || null,
      endsAt: metadata?.endsAt || null,
      systemName: canonicalSystemName(system?.name || visit.systemName),
      mainContractor: visit.mainContractor,
      subContractor: canonicalContractorName(contractor?.name || visit.subContractor),
    },
    references: {
      systemId: system?.id || null,
      contractorId: contractor?.id || null,
      representativeId: representative?.id || null,
      siteApprovalId: siteApproval?.id || null,
      qualificationId: qualification?.id || null,
    },
    verification: {
      representativeActive: representative?.isActive === true,
      residenceException: representative?.noResidenceException === true,
      residenceExceptionReason: representative?.noResidenceException ? representative.exceptionReason : null,
      siteApproved: siteApproval?.status === "active",
      contractorQualified: qualification?.status === "active",
    },
  };
}

async function ensurePermitToken(executor: AnyDb, visitId: number) {
  const [existing] = await executor.select().from(visitPermitTokensTable)
    .where(and(eq(visitPermitTokensTable.visitId, visitId), eq(visitPermitTokensTable.status, "active")))
    .orderBy(desc(visitPermitTokensTable.issuedAt)).limit(1);
  if (existing) return existing;
  const generated = createPermitToken();
  const [inserted] = await executor.insert(visitPermitTokensTable).values({
    visitId,
    tokenHash: generated.tokenHash,
    tokenCiphertext: generated.tokenCiphertext,
    status: "active",
  }).onConflictDoNothing().returning();
  if (inserted) return inserted;
  const [concurrent] = await executor.select().from(visitPermitTokensTable)
    .where(and(eq(visitPermitTokensTable.visitId, visitId), eq(visitPermitTokensTable.status, "active")))
    .orderBy(desc(visitPermitTokensTable.issuedAt)).limit(1);
  if (!concurrent) throw new Error("ACTIVE_QR_TOKEN_NOT_AVAILABLE");
  return concurrent;
}

async function nextPermitNumber(executor: AnyDb, visit: any): Promise<string> {
  const year = new Date().getFullYear();
  // One global sequence per year prevents duplicates across hospitals too.
  const scopeKey = `${year}:global`;
  const [sequence] = await executor.insert(visitNumberSequencesTable).values({ scopeKey, lastValue: 1 })
    .onConflictDoUpdate({
      target: visitNumberSequencesTable.scopeKey,
      set: { lastValue: sql`${visitNumberSequencesTable.lastValue} + 1`, updatedAt: new Date() },
    })
    .returning({ lastValue: visitNumberSequencesTable.lastValue });
  if (!sequence) throw new Error("SERIAL_SEQUENCE_NOT_RETURNED");
  return `${year}-${String(sequence.lastValue).padStart(6, "0")}`;
}

type CentralValidationOptions = { qualificationOptional?: boolean };

async function validateCentralContext(executor: AnyDb, context: VisitContext, options: CentralValidationOptions = {}): Promise<string | null> {
  const { visit, metadata, system, contractor, representative, siteApproval, qualification } = context;
  if (!metadata?.systemId || !metadata?.contractorId || !metadata?.representativeId || !metadata?.siteApprovalId) {
    return "يجب ربط الطلب بالنظام والشركة والمندوب واعتماد الموقع قبل الاعتماد";
  }
  if (!options.qualificationOptional && !metadata?.qualificationId) {
    return "يجب ربط الطلب بالنظام والشركة والمندوب واعتماد الموقع والتأهيل قبل الاعتماد";
  }
  if (!system?.isActive) return "النظام المحدد معطل";
  if (!contractor?.isActive) return "شركة مقاول الباطن معطلة";
  if (!representative?.isActive) return "المندوب المحدد معطل";
  if (representative.contractorId !== contractor.id) return "المندوب لا يتبع شركة مقاول الباطن المحددة";
  const visitDay = parseIsoDate(String(visit.visitDate));
  if (!visitDay) return "تاريخ الزيارة غير صالح";
  if (siteApproval?.siteName !== visit.siteLocation || siteApproval?.systemId !== system.id || siteApproval?.contractorId !== contractor.id || siteApproval?.status !== "active" || !isDateWithin(visitDay, siteApproval?.validFrom, siteApproval?.validUntil)) {
    return "الموقع غير معتمد لهذا النظام والشركة في تاريخ الزيارة";
  }
  if (metadata.qualificationId && (qualification?.contractorId !== contractor.id || qualification?.systemId !== system.id || qualification?.status !== "active" || !isDateWithin(visitDay, qualification?.validFrom, qualification?.validUntil))) {
    return "تأهيل الشركة للنظام غير ساري في تاريخ الزيارة";
  }
  const [repSystem] = await executor.select({ id: visitRepresentativeSystemsTable.id })
    .from(visitRepresentativeSystemsTable)
    .where(and(
      eq(visitRepresentativeSystemsTable.representativeId, representative.id),
      eq(visitRepresentativeSystemsTable.systemId, system.id),
      eq(visitRepresentativeSystemsTable.isActive, true),
    )).limit(1);
  if (!repSystem) return "المندوب غير مرتبط بالنظام المحدد";
  if (representative.noResidenceException) {
    if (!cleanText(representative.exceptionReason, 1_000)) return "الاستثناء بدون إقامة يحتاج سببًا إجباريًا ومسجلًا";
  } else if (representative.residenceExpiresAt) {
    const expiry = parseIsoDate(String(representative.residenceExpiresAt || ""));
    if (!expiry || expiry.toISOString().slice(0, 10) < visitDay.toISOString().slice(0, 10)) return "الإقامة منتهية أو لا تغطي تاريخ الزيارة";
  }
  const window = validateVisitWindow(metadata.startsAt, metadata.endsAt);
  if ("error" in window) return window.error;
  return null;
}

async function approveVisit(executor: AnyDb, visitId: number, user: any, options: CentralValidationOptions = {}): Promise<VisitContext> {
  let context = await getVisitContext(executor, visitId);
  if (!context) throw new Error("VISIT_NOT_FOUND");
  if (context.visit.status === "cancelled") throw new Error("VISIT_CANCELLED");
  const validationError = await validateCentralContext(executor, context, options);
  if (validationError) throw new Error(`VALIDATION:${validationError}`);
  const serialNumber = context.visit.serialNumber || await nextPermitNumber(executor, context.visit);
  const approvedAt = context.visit.approvedAt || new Date();
  const snapshotJson = JSON.stringify(snapshotFor(context));
  await executor.update(visitRequestMetadataTable).set({ snapshotJson, linkedAt: context.metadata.linkedAt || new Date(), linkedByUserId: user.id, updatedAt: new Date() })
    .where(eq(visitRequestMetadataTable.visitId, visitId));
  await executor.update(visitRequestsTable).set({
    status: "approved",
    serialNumber,
    approvedAt,
    adminNotes: null,
    updatedAt: new Date(),
  }).where(eq(visitRequestsTable.id, visitId));
  await ensurePermitToken(executor, visitId);
  context = await getVisitContext(executor, visitId);
  if (!context) throw new Error("VISIT_NOT_FOUND_AFTER_APPROVAL");
  return context;
}

async function canAccessVisit(user: any, visit: any): Promise<boolean> {
  return hasClusterVisitManagement(user) || (visit.userId != null && Number(visit.userId) === Number(user.id));
}

function isResidenceVerified(representative: any | null, visit: any): boolean {
  if (!representative) return false;
  if (representative.noResidenceException) return !!cleanText(representative.exceptionReason, 1_000);
  const expiry = dayString(representative.residenceExpiresAt), visitDay = dayString(visit.visitDate);
  return !!expiry && !!visitDay && expiry >= visitDay;
}

async function hasActiveVisitDocuments(visitId: number, metadata: any | null): Promise<boolean> {
  const scopes: any[] = [and(eq(visitDocumentsTable.ownerType, "visit"), eq(visitDocumentsTable.ownerId, visitId))];
  if (metadata?.representativeId) scopes.push(and(eq(visitDocumentsTable.ownerType, "representative"), eq(visitDocumentsTable.ownerId, metadata.representativeId)));
  if (metadata?.contractorId) scopes.push(and(eq(visitDocumentsTable.ownerType, "contractor"), eq(visitDocumentsTable.ownerId, metadata.contractorId)));
  if (metadata?.qualificationId) scopes.push(and(eq(visitDocumentsTable.ownerType, "qualification"), eq(visitDocumentsTable.ownerId, metadata.qualificationId)));
  if (metadata?.siteApprovalId) scopes.push(and(eq(visitDocumentsTable.ownerType, "site_approval"), eq(visitDocumentsTable.ownerId, metadata.siteApprovalId)));
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(visitDocumentsTable)
    .where(and(eq(visitDocumentsTable.status, "active"), or(...scopes)));
  return Number(row?.count || 0) > 0;
}

async function visitDocumentOwnerExists(ownerType: string, ownerId: number): Promise<boolean> {
  const table = ownerType === "visit" ? visitRequestsTable
    : ownerType === "representative" ? visitRepresentativesTable
      : ownerType === "contractor" ? visitContractorsTable
        : ownerType === "qualification" ? visitQualificationsTable
          : ownerType === "site_approval" ? visitSiteApprovalsTable
            : null;
  if (!table) return false;
  const [row] = await db.select({ id: table.id }).from(table as any).where(eq((table as any).id, ownerId)).limit(1);
  return !!row;
}

async function storeDocument(req: any, ownerType: string, ownerId: number, documentType: string, file: Express.Multer.File) {
  const detected = detectVisitFile(file.buffer);
  if (!detected) throw new Error("FILE_MAGIC_MISMATCH");
  if (file.mimetype && file.mimetype !== "application/octet-stream" && file.mimetype !== detected.mimeType) throw new Error("FILE_MIME_MISMATCH");
  const digest = sha256(file.buffer);
  return db.transaction(async (tx) => {
    const [duplicate] = await tx.select({ id: visitDocumentsTable.id }).from(visitDocumentsTable)
      .where(and(
        eq(visitDocumentsTable.ownerType, ownerType as any),
        eq(visitDocumentsTable.ownerId, ownerId),
        eq(visitDocumentsTable.documentType, documentType),
        eq(visitDocumentsTable.sha256, digest),
      )).limit(1);
    if (duplicate) throw new Error("DUPLICATE_DOCUMENT");
    const [previous] = await tx.select().from(visitDocumentsTable)
      .where(and(
        eq(visitDocumentsTable.ownerType, ownerType as any),
        eq(visitDocumentsTable.ownerId, ownerId),
        eq(visitDocumentsTable.documentType, documentType),
        eq(visitDocumentsTable.status, "active"),
      )).orderBy(desc(visitDocumentsTable.createdAt)).limit(1);
    const [document] = await tx.insert(visitDocumentsTable).values({
      ownerType: ownerType as any,
      ownerId,
      documentType,
      originalName: sanitizeFilename(file.originalname),
      mimeType: detected.mimeType,
      sizeBytes: file.buffer.length,
      sha256: digest,
      status: "active",
      uploadedByUserId: req.currentUser.id,
    }).returning();
    await tx.insert(visitDocumentContentsTable).values({ documentId: document.id, content: file.buffer });
    if (previous) {
      await tx.update(visitDocumentsTable).set({ status: "replaced", disabledAt: new Date(), replacedByDocumentId: document.id })
        .where(eq(visitDocumentsTable.id, previous.id));
    }
    return { document, replacedDocumentId: previous?.id || null };
  });
}

function parseZipRecords(zip: AdmZip): Record<string, any[]> {
  const records: Record<string, any[]> = {};
  const allowed = new Set(["systems", "contractors", "qualifications", "siteApprovals", "representatives", "representativeSystems"]);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const base = entry.entryName.replace(/\\/g, "/").split("/").at(-1) || "";
    const key = base.replace(/\.json$/i, "");
    if (!allowed.has(key) || !/\.json$/i.test(base)) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(entry.getData().toString("utf8")); } catch { throw new Error(`ملف JSON غير صالح: ${base}`); }
    if (!Array.isArray(parsed)) throw new Error(`محتوى ${base} يجب أن يكون مصفوفة`);
    records[key] = parsed.slice(0, 5_000);
  }
  return records;
}

async function importZipRecords(records: Record<string, any[]>, userId: number) {
  return db.transaction(async (tx) => {
    const counts: Record<string, number> = {};
    for (const row of records.systems || []) {
      const name = cleanText(row.name, 200); if (!name) continue;
      await tx.insert(visitSystemsTable).values({ name, code: cleanText(row.code, 80) || null, description: cleanText(row.description, 1_000) || null, createdByUserId: userId })
        .onConflictDoUpdate({ target: visitSystemsTable.name, set: { code: cleanText(row.code, 80) || null, description: cleanText(row.description, 1_000) || null, isActive: true, updatedAt: new Date() } });
      counts.systems = (counts.systems || 0) + 1;
    }
    for (const row of records.contractors || []) {
      const name = cleanText(row.name, 200); if (!name) continue;
      await tx.insert(visitContractorsTable).values({ name, registrationNumber: cleanText(row.registrationNumber, 100) || null, contactName: cleanText(row.contactName, 200) || null, contactMobile: cleanText(row.contactMobile, 30) || null, createdByUserId: userId })
        .onConflictDoUpdate({ target: visitContractorsTable.name, set: { registrationNumber: cleanText(row.registrationNumber, 100) || null, contactName: cleanText(row.contactName, 200) || null, contactMobile: cleanText(row.contactMobile, 30) || null, isActive: true, updatedAt: new Date() } });
      counts.contractors = (counts.contractors || 0) + 1;
    }
    // Relational rows require stable numeric IDs from the preview payload.
    // They are inserted only when all references are valid; malformed rows do
    // not partially mutate the catalogue.
    for (const row of records.representatives || []) {
      const contractorId = numberId(row.contractorId);
      const identityNumber = cleanText(row.identityNumber, 40);
      const mobile = cleanText(row.mobile, 30);
      const fullName = cleanText(row.fullName, 200);
      if (!contractorId || !identityNumber || !fullName || !isValidSaudiMobile(mobile)) continue;
      const exception = row.noResidenceException === true;
      const exceptionReason = cleanText(row.exceptionReason, 1_000);
      if (exception && !exceptionReason) continue;
      await tx.insert(visitRepresentativesTable).values({ contractorId, identityNumber, mobile, fullName, residenceExpiresAt: dayString(row.residenceExpiresAt), noResidenceException: exception, exceptionReason: exception ? exceptionReason : null })
        .onConflictDoUpdate({ target: visitRepresentativesTable.identityNumber, set: { contractorId, mobile, fullName, residenceExpiresAt: dayString(row.residenceExpiresAt), noResidenceException: exception, exceptionReason: exception ? exceptionReason : null, isActive: true, updatedAt: new Date() } });
      counts.representatives = (counts.representatives || 0) + 1;
    }
    for (const row of records.qualifications || []) {
      const contractorId = numberId(row.contractorId), systemId = numberId(row.systemId);
      const validFrom = dayString(row.validFrom), validUntil = dayString(row.validUntil);
      if (!contractorId || !systemId || !validFrom || !validUntil || validUntil < validFrom) continue;
      await tx.insert(visitQualificationsTable).values({ contractorId, systemId, validFrom, validUntil, status: "active", notes: cleanText(row.notes, 1_000) || null })
        .onConflictDoUpdate({ target: [visitQualificationsTable.contractorId, visitQualificationsTable.systemId], set: { validFrom, validUntil, status: "active", notes: cleanText(row.notes, 1_000) || null, updatedAt: new Date() } });
      counts.qualifications = (counts.qualifications || 0) + 1;
    }
    for (const row of records.siteApprovals || []) {
      const siteName = cleanText(row.siteName, 200), contractorId = numberId(row.contractorId), systemId = numberId(row.systemId);
      const validFrom = dayString(row.validFrom), validUntil = dayString(row.validUntil);
      if (!siteName || !contractorId || !systemId || !validFrom || !validUntil || validUntil < validFrom) continue;
      await tx.insert(visitSiteApprovalsTable).values({ siteName, contractorId, systemId, validFrom, validUntil, status: "active", notes: cleanText(row.notes, 1_000) || null })
        .onConflictDoUpdate({ target: [visitSiteApprovalsTable.siteName, visitSiteApprovalsTable.systemId, visitSiteApprovalsTable.contractorId], set: { validFrom, validUntil, status: "active", notes: cleanText(row.notes, 1_000) || null, updatedAt: new Date() } });
      counts.siteApprovals = (counts.siteApprovals || 0) + 1;
    }
    for (const row of records.representativeSystems || []) {
      const representativeId = numberId(row.representativeId), systemId = numberId(row.systemId);
      if (!representativeId || !systemId) continue;
      await tx.insert(visitRepresentativeSystemsTable).values({ representativeId, systemId, isActive: true })
        .onConflictDoUpdate({ target: [visitRepresentativeSystemsTable.representativeId, visitRepresentativeSystemsTable.systemId], set: { isActive: true } });
      counts.representativeSystems = (counts.representativeSystems || 0) + 1;
    }
    return counts;
  });
}

// ── Shared settings and submitter endpoints ─────────────────────────────────
router.get("/settings", requireAuth, requireApproved, async (_req, res) => {
  const [stamp, signature, signerName, signerTitle, legacyManagerName] = await Promise.all([
    getSetting("visit_stamp"), getSetting("visit_signature"), getSetting("visit_signer_name"), getSetting("visit_signer_title"), getSetting("visit_manager_name"),
  ]);
  const effectiveSignerName = signerName || legacyManagerName || DEFAULT_VISIT_SIGNER_NAME;
  res.setHeader("Cache-Control", "no-store");
  return res.json({
    stamp,
    signature,
    signerName: effectiveSignerName,
    signerTitle: signerTitle || DEFAULT_VISIT_SIGNER_TITLE,
    // Compatibility for clients deployed before signer fields were renamed.
    managerName: effectiveSignerName,
  });
});

router.post("/settings", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const { stamp, signature } = req.body || {};
  const signerName = req.body?.signerName ?? req.body?.managerName;
  const signerTitle = req.body?.signerTitle;
  let normalizedStamp: string | undefined;
  let normalizedSignature: string | undefined;
  try {
    normalizedStamp = stamp === undefined ? undefined : normalizedPrintAsset(stamp);
    normalizedSignature = signature === undefined ? undefined : normalizedPrintAsset(signature);
  } catch (err: any) {
    if (err?.message === "PRINT_ASSET_SIZE") return res.status(413).json({ error: "حجم صورة الختم أو التوقيع يتجاوز 2 ميجابايت" });
    if (err?.message === "PRINT_ASSET_FORMAT" || err?.message === "PRINT_ASSET_MAGIC") return res.status(415).json({ error: "يجب رفع صورة PNG أو JPEG حقيقية للختم والتوقيع" });
    return res.status(400).json({ error: "بيانات الختم أو التوقيع غير صالحة" });
  }
  try {
    const ops: Promise<void>[] = [];
    if (normalizedStamp !== undefined) ops.push(setSetting("visit_stamp", normalizedStamp, req.currentUser.email));
    if (normalizedSignature !== undefined) ops.push(setSetting("visit_signature", normalizedSignature, req.currentUser.email));
    if (signerName !== undefined) ops.push(setSetting("visit_signer_name", cleanText(signerName, 200) || DEFAULT_VISIT_SIGNER_NAME, req.currentUser.email));
    if (signerTitle !== undefined) ops.push(setSetting("visit_signer_title", cleanText(signerTitle, 200) || DEFAULT_VISIT_SIGNER_TITLE, req.currentUser.email));
    await Promise.all(ops);
  } catch (err: any) {
    req.log.error({ err }, "Failed to update visit print settings");
    return res.status(500).json({ error: "تعذر حفظ إعدادات الطباعة" });
  }
  await audit(req, "تحديث إعدادات طباعة تصاريح الزيارة", { fields: Object.keys(req.body || {}) });
  return res.json({ success: true });
});

router.get("/catalog", requireAuth, requireApproved, async (req: any, res) => {
  const cluster = hasClusterVisitManagement(req.currentUser);
  const [systems, contractors, qualifications, siteApprovals, representatives, representativeSystems] = await Promise.all([
    db.select().from(visitSystemsTable).orderBy(asc(visitSystemsTable.name)),
    db.select().from(visitContractorsTable).orderBy(asc(visitContractorsTable.name)),
    db.select().from(visitQualificationsTable),
    db.select().from(visitSiteApprovalsTable),
    db.select().from(visitRepresentativesTable).orderBy(asc(visitRepresentativesTable.fullName)),
    db.select().from(visitRepresentativeSystemsTable),
  ]);
  return res.json({
    systems: systems.filter((x) => cluster || x.isActive).map(({ createdByUserId: _createdBy, ...x }) => ({ ...x, displayName: canonicalSystemName(x.name) })),
    contractors: contractors.filter((x) => cluster || x.isActive).map(({ registrationNumber, contactMobile, ...x }) => cluster ? { ...x, registrationNumber, contactMobile, displayName: canonicalContractorName(x.name) } : { ...x, displayName: canonicalContractorName(x.name) }),
    qualifications: qualifications.filter((x) => cluster || x.status === "active"),
    siteApprovals: siteApprovals.filter((x) => cluster || (x.status === "active" && x.siteName === req.currentUser.hospital)),
    representatives: representatives.filter((x) => cluster || x.isActive).map((x) => ({
      id: x.id,
      contractorId: x.contractorId,
      fullName: x.fullName,
      identityMasked: maskIdentity(x.identityNumber),
      residenceExpiresAt: x.residenceExpiresAt,
      noResidenceException: x.noResidenceException,
      exceptionReason: cluster ? x.exceptionReason : undefined,
      isActive: x.isActive,
    })),
    representativeSystems: representativeSystems.filter((x) => cluster || x.isActive),
  });
});

router.post("/", requireAuth, requireApproved, async (req: any, res) => {
  const body = req.body || {};
  const systemId = numberId(body.systemId);
  const contractorId = numberId(body.contractorId);
  const representativeId = numberId(body.representativeId);
  const siteApprovalId = numberId(body.siteApprovalId);
  const qualificationId = numberId(body.qualificationId);
  const purpose = DEFAULT_VISIT_PURPOSE;
  const visitDate = dayString(body.visitDate || body.startsAt);
  if (!visitDate) return res.status(400).json({ error: "تاريخ الزيارة غير صالح" });

  let resolved: any = null;
  if (systemId || contractorId || representativeId || siteApprovalId || qualificationId) {
    if (!systemId || !contractorId || !representativeId || !siteApprovalId || !qualificationId) return res.status(400).json({ error: "يجب اختيار النظام والشركة والمندوب واعتماد الموقع والتأهيل" });
    const [system, contractor, representative, siteApproval, qualification] = await Promise.all([
      db.select().from(visitSystemsTable).where(eq(visitSystemsTable.id, systemId)).limit(1),
      db.select().from(visitContractorsTable).where(eq(visitContractorsTable.id, contractorId)).limit(1),
      db.select().from(visitRepresentativesTable).where(eq(visitRepresentativesTable.id, representativeId)).limit(1),
      db.select().from(visitSiteApprovalsTable).where(eq(visitSiteApprovalsTable.id, siteApprovalId)).limit(1),
      db.select().from(visitQualificationsTable).where(eq(visitQualificationsTable.id, qualificationId)).limit(1),
    ]);
    resolved = { system: system[0], contractor: contractor[0], representative: representative[0], siteApproval: siteApproval[0], qualification: qualification[0] };
    if (!resolved.system || !resolved.contractor || !resolved.representative || !resolved.siteApproval || !resolved.qualification) return res.status(400).json({ error: "أحد المراجع المركزية المحددة غير موجود" });
  }

  const window = validateVisitWindow(body.startsAt || `${visitDate}T00:00:00.000Z`, body.endsAt);
  if ("error" in window) return res.status(400).json({ error: window.error });
  const repName = resolved?.representative?.fullName || cleanText(body.repName, 200);
  const repId = resolved?.representative?.identityNumber || cleanText(body.repId, 40);
  const repMobile = resolved?.representative?.mobile || cleanText(body.repMobile, 30);
  const siteLocation = resolved?.siteApproval?.siteName || cleanText(body.siteLocation || req.currentUser.hospital, 200);
  const systemName = canonicalSystemName(resolved?.system?.name || cleanText(body.systemName, 250));
  const subContractor = canonicalContractorName(resolved?.contractor?.name || cleanText(body.subContractor, 250));
  const mainContractor = cleanText(body.mainContractor || req.currentUser.company || "تجمع نجران الصحي", 250);
  if (!repName || !repId || !isValidSaudiMobile(repMobile) || !siteLocation || !systemName || !subContractor) {
    return res.status(400).json({ error: "الاسم والهوية والجوال السعودي والموقع والنظام والشركة حقول مطلوبة" });
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [visit] = await tx.insert(visitRequestsTable).values({
        userId: req.currentUser.id,
        repName, repId, repMobile, siteLocation, visitDate,
        systemName, mainContractor, subContractor,
        status: "pending",
        submittedByName: req.currentUser.name,
        submittedByHospital: req.currentUser.hospital || siteLocation,
        submittedByContract: req.currentUser.contractNumber || null,
      }).returning();
      await tx.insert(visitRequestMetadataTable).values({
        visitId: visit.id,
        systemId, contractorId, representativeId, siteApprovalId, qualificationId,
        purpose, startsAt: window.startsAt, endsAt: window.endsAt,
        linkedAt: resolved ? new Date() : null,
        linkedByUserId: resolved ? req.currentUser.id : null,
      });
      await ensurePermitToken(tx, visit.id);
      return visit;
    });
    await audit(req, "إنشاء طلب زيارة مقاول باطن", { visitId: created.id, centralLinked: !!resolved, siteLocation, systemName });
    sendVisitNewRequestEmail(ADMIN_EMAIL, { repName, siteLocation, systemName, mainContractor, subContractor, visitDate, submittedByName: req.currentUser.name, submittedByHospital: req.currentUser.hospital || null }).catch((err) => req.log.error({ err }, "Failed to send visit request email"));
    return res.status(201).json({ visit: sanitizeVisit(created, { purpose, startsAt: window.startsAt, endsAt: window.endsAt }) });
  } catch (err) {
    req.log.error({ err }, "Failed to create visit request");
    return res.status(500).json({ error: "تعذر حفظ طلب الزيارة" });
  }
});

router.post("/management/direct-issue", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const systemId = numberId(req.body.systemId), contractorId = numberId(req.body.contractorId), representativeId = numberId(req.body.representativeId), siteApprovalId = numberId(req.body.siteApprovalId), qualificationId = numberId(req.body.qualificationId);
  const purpose = DEFAULT_VISIT_PURPOSE;
  const maintenance = maintenanceContractor(req.body.maintenanceContractorKey);
  const siteName = cleanText(req.body.siteName, 200);
  const window = validateVisitWindow(req.body.startsAt, req.body.endsAt);
  if (!maintenance) return res.status(400).json({ error: "اختر مقاول الصيانة: بيت العرب أو سراكو" });
  if (!siteName || !(maintenance.sites as readonly string[]).includes(siteName)) return res.status(400).json({ error: "الموقع المحدد لا يتبع مقاول الصيانة المختار" });
  if (!systemId || !contractorId || !representativeId || !siteApprovalId) return res.status(400).json({ error: "النظام والشركة والمندوب واعتماد الموقع مطلوبة للإصدار المباشر" });
  if ("error" in window) return res.status(400).json({ error: window.error });
  const [systemRows, contractorRows, representativeRows, approvalRows] = await Promise.all([
    db.select().from(visitSystemsTable).where(eq(visitSystemsTable.id, systemId)).limit(1),
    db.select().from(visitContractorsTable).where(eq(visitContractorsTable.id, contractorId)).limit(1),
    db.select().from(visitRepresentativesTable).where(eq(visitRepresentativesTable.id, representativeId)).limit(1),
    db.select().from(visitSiteApprovalsTable).where(eq(visitSiteApprovalsTable.id, siteApprovalId)).limit(1),
  ]);
  const system = systemRows[0], contractor = contractorRows[0], representative = representativeRows[0], approval = approvalRows[0];
  if (!system || !contractor || !representative || !approval) return res.status(400).json({ error: "أحد مراجع الإصدار المباشر غير موجود" });
  if (approval.siteName !== siteName) return res.status(400).json({ error: "اعتماد الموقع لا يطابق الموقع المحدد" });
  try {
    const context = await db.transaction(async (tx) => {
      const [visit] = await tx.insert(visitRequestsTable).values({
        userId: req.currentUser.id,
        repName: representative.fullName,
        siteLocation: approval.siteName,
        repId: representative.identityNumber,
        visitDate: window.startsAt.toISOString().slice(0, 10),
        repMobile: representative.mobile,
        systemName: canonicalSystemName(system.name),
        mainContractor: maintenance.name,
        subContractor: canonicalContractorName(contractor.name),
        status: "pending",
        submittedByName: req.currentUser.name,
        submittedByHospital: approval.siteName,
        submittedByContract: cleanText(req.body.contractNumber, 100) || null,
      }).returning();
      await tx.insert(visitRequestMetadataTable).values({ visitId: visit.id, systemId, contractorId, representativeId, siteApprovalId, qualificationId, purpose, startsAt: window.startsAt, endsAt: window.endsAt, linkedAt: new Date(), linkedByUserId: req.currentUser.id });
      await ensurePermitToken(tx, visit.id);
      return approveVisit(tx, visit.id, req.currentUser, { qualificationOptional: true });
    });
    await audit(req, "إصدار مباشر لتصريح زيارة", { visitId: context.visit.id, serialNumber: context.visit.serialNumber, maintenanceContractor: maintenance.name, siteLocation: context.visit.siteLocation, qualificationId: qualificationId || null, qualificationDeferred: !qualificationId, endsAtProvided: !!window.endsAt });
    return res.status(201).json({ visit: sanitizeVisit(context.visit, context.metadata) });
  } catch (err: any) {
    if (String(err?.message).startsWith("VALIDATION:")) return res.status(400).json({ error: String(err.message).slice(11) });
    req.log.error({ err }, "Direct visit issue failed");
    return res.status(500).json({ error: "تعذر الإصدار المباشر" });
  }
});

router.get("/", requireAuth, requireApproved, async (req: any, res) => {
  const cluster = hasClusterVisitManagement(req.currentUser);
  const query = db.select({ visit: visitRequestsTable, metadata: visitRequestMetadataTable })
    .from(visitRequestsTable)
    .leftJoin(visitRequestMetadataTable, eq(visitRequestMetadataTable.visitId, visitRequestsTable.id))
    .orderBy(desc(visitRequestsTable.createdAt));
  const rows = cluster ? await query : await query.where(eq(visitRequestsTable.userId, req.currentUser.id));
  return res.json({ visits: rows.map((row) => sanitizeVisit(row.visit, row.metadata)) });
});

router.get("/:id", requireAuth, requireApproved, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم زيارة غير صالح" });
  const context = await getVisitContext(db, id); if (!context) return res.status(404).json({ error: "الزيارة غير موجودة" });
  if (!await canAccessVisit(req.currentUser, context.visit)) return res.status(403).json({ error: "غير مصرح بعرض الزيارة" });
  const docs = hasClusterVisitManagement(req.currentUser)
    ? await db.select({ id: visitDocumentsTable.id, documentType: visitDocumentsTable.documentType, originalName: visitDocumentsTable.originalName, mimeType: visitDocumentsTable.mimeType, sizeBytes: visitDocumentsTable.sizeBytes, status: visitDocumentsTable.status, createdAt: visitDocumentsTable.createdAt }).from(visitDocumentsTable).where(and(eq(visitDocumentsTable.ownerType, "visit"), eq(visitDocumentsTable.ownerId, id))).orderBy(desc(visitDocumentsTable.createdAt))
    : [];
  return res.json({
    visit: sanitizeVisit(context.visit, context.metadata),
    central: {
      system: context.system ? { id: context.system.id, name: context.system.name } : null,
      contractor: context.contractor ? { id: context.contractor.id, name: context.contractor.name } : null,
      representative: context.representative ? { id: context.representative.id, fullName: context.representative.fullName, identityMasked: maskIdentity(context.representative.identityNumber) } : null,
      siteApprovalId: context.siteApproval?.id || null,
      qualificationId: context.qualification?.id || null,
    },
    documents: docs,
  });
});

// ── Center bootstrap, catalogue management and linking ──────────────────────
async function seedVisitCatalogFromLegacyRequests(req: any) {
  const legacyRows = await db.selectDistinct({
    systemName: visitRequestsTable.systemName,
    contractorName: visitRequestsTable.subContractor,
  }).from(visitRequestsTable);
  const systemNames = [...new Set(legacyRows.map((row) => cleanText(row.systemName, 200)).filter(Boolean))];
  const contractorNames = [...new Set(legacyRows.map((row) => cleanText(row.contractorName, 200)).filter(Boolean))];
  if (!systemNames.length && !contractorNames.length) return { systems: 0, contractors: 0 };
  const inserted = await db.transaction(async (tx) => {
    let systems = 0;
    let contractors = 0;
    for (const name of systemNames) {
      const rows = await tx.insert(visitSystemsTable).values({ name, createdByUserId: req.currentUser.id }).onConflictDoNothing().returning({ id: visitSystemsTable.id });
      systems += rows.length;
    }
    for (const name of contractorNames) {
      const rows = await tx.insert(visitContractorsTable).values({ name, createdByUserId: req.currentUser.id }).onConflictDoNothing().returning({ id: visitContractorsTable.id });
      contractors += rows.length;
    }
    return { systems, contractors };
  });
  if (inserted.systems || inserted.contractors) {
    await audit(req, "استكمال كتالوج الزيارات من السجلات السابقة", inserted);
  }
  return inserted;
}

async function seedApprovedSubcontractorCatalog(req: any) {
  const [existingSystems, existingContractors] = await Promise.all([
    db.select({ id: visitSystemsTable.id, name: visitSystemsTable.name, description: visitSystemsTable.description, isActive: visitSystemsTable.isActive }).from(visitSystemsTable),
    db.select({ id: visitContractorsTable.id, name: visitContractorsTable.name }).from(visitContractorsTable),
  ]);
  const systemKeys = new Set(existingSystems.map((row) => catalogNameKey(canonicalSystemName(row.name))));
  const officialSystemKeys = new Set(APPROVED_SUBCONTRACTOR_CATALOG.map((row) => catalogNameKey(canonicalSystemName(row.system))));
  const contractorKeys = new Set(existingContractors.map((row) => catalogNameKey(canonicalContractorName(row.name))));
  const inserted = await db.transaction(async (tx) => {
    let systems = 0;
    let systemsDisabled = 0;
    let contractors = 0;
    for (const existing of existingSystems) {
      const isOutdatedCatalogSystem = existing.isActive
        && existing.description === APPROVED_CATALOG_SOURCE
        && !officialSystemKeys.has(catalogNameKey(canonicalSystemName(existing.name)));
      if (!isOutdatedCatalogSystem) continue;
      await tx.update(visitSystemsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(visitSystemsTable.id, existing.id));
      systemsDisabled += 1;
    }
    for (const catalog of APPROVED_SUBCONTRACTOR_CATALOG) {
      const systemKey = catalogNameKey(canonicalSystemName(catalog.system));
      if (!systemKeys.has(systemKey)) {
        const rows = await tx.insert(visitSystemsTable).values({ name: canonicalSystemName(catalog.system), description: APPROVED_CATALOG_SOURCE, createdByUserId: req.currentUser.id }).onConflictDoNothing().returning({ id: visitSystemsTable.id });
        if (rows.length) { systems += 1; systemKeys.add(systemKey); }
      }
      for (const name of catalog.contractors) {
        const contractorKey = catalogNameKey(canonicalContractorName(name));
        if (contractorKeys.has(contractorKey)) continue;
        const rows = await tx.insert(visitContractorsTable).values({ name: canonicalContractorName(name), createdByUserId: req.currentUser.id }).onConflictDoNothing().returning({ id: visitContractorsTable.id });
        if (rows.length) { contractors += 1; contractorKeys.add(contractorKey); }
      }
    }
    return { systems, systemsDisabled, contractors };
  });
  if (inserted.systems || inserted.systemsDisabled || inserted.contractors) await audit(req, "مزامنة أسماء مقاولي الباطن المعتمدين", inserted);
  return inserted;
}

async function seedCertificateQualifications(req: any) {
  const [systems, contractors] = await Promise.all([
    db.select().from(visitSystemsTable),
    db.select().from(visitContractorsTable),
  ]);
  const systemByKey = firstCanonicalRowMap(systems, canonicalSystemName);
  const contractorByKey = firstCanonicalRowMap(contractors, canonicalContractorName);
  const inserted = await db.transaction(async (tx) => {
    let qualifications = 0;
    for (const certificate of QUALIFICATION_CERTIFICATES) {
      const system = systemByKey.get(catalogNameKey(certificate.system));
      const contractor = contractorByKey.get(catalogNameKey(certificate.company));
      if (!system || !contractor) continue;
      if (!contractor.contactMobile && certificate.contactMobile) {
        await tx.update(visitContractorsTable).set({ contactMobile: certificate.contactMobile, updatedAt: new Date() }).where(eq(visitContractorsTable.id, contractor.id));
      }
      const rows = await tx.insert(visitQualificationsTable).values({
        contractorId: contractor.id,
        systemId: system.id,
        validFrom: certificate.validFrom,
        validUntil: certificate.validUntil,
        status: "active",
        notes: `شهادة تأهيل ${certificate.reference}`,
      }).onConflictDoNothing({ target: [visitQualificationsTable.contractorId, visitQualificationsTable.systemId] }).returning({ id: visitQualificationsTable.id });
      qualifications += rows.length;
    }
    return { qualifications };
  });
  if (inserted.qualifications) await audit(req, "مزامنة مدد شهادات تأهيل مقاولي الباطن", inserted);
  return inserted;
}

function firstCanonicalRowMap(rows: any[], canonicalizer: (value: unknown) => string) {
  const result = new Map<string, any>();
  for (const row of rows) {
    const key = catalogNameKey(canonicalizer(row.name));
    if (!result.has(key)) result.set(key, row);
  }
  return result;
}

function approvedCatalogResponse(systems: any[], contractors: any[]) {
  const systemByKey = firstCanonicalRowMap(systems, canonicalSystemName);
  const contractorByKey = firstCanonicalRowMap(contractors, canonicalContractorName);
  return APPROVED_SUBCONTRACTOR_CATALOG.map((catalog) => {
    const system = systemByKey.get(catalogNameKey(canonicalSystemName(catalog.system)));
    return {
      systemId: system?.id || null,
      systemName: canonicalSystemName(system?.name || catalog.system),
      contractors: catalog.contractors.map((name) => contractorByKey.get(catalogNameKey(canonicalContractorName(name)))).filter(Boolean).map((row) => ({ id: row.id, name: canonicalContractorName(row.name) })),
    };
  }).filter((row) => row.systemId);
}

function approvedPersonnelResponse(systems: any[], contractors: any[]) {
  const systemByKey = firstCanonicalRowMap(systems, canonicalSystemName);
  const contractorByKey = firstCanonicalRowMap(contractors, canonicalContractorName);
  return QUALIFICATION_CERTIFICATES.flatMap((certificate) => {
    const system = systemByKey.get(catalogNameKey(certificate.system));
    const contractor = contractorByKey.get(catalogNameKey(certificate.company));
    if (!system || !contractor) return [];
    return certificate.personnel.map((fullName) => ({
      contractorId: contractor.id,
      systemId: system.id,
      systemName: canonicalSystemName(system.name),
      fullName,
      sourceCertificate: certificate.reference,
      requiresManualCompletion: true,
    }));
  });
}

router.get("/management/bootstrap", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  await seedVisitCatalogFromLegacyRequests(req);
  await seedApprovedSubcontractorCatalog(req);
  await seedCertificateQualifications(req);
  const [catalogResponse, pending, alerts] = await Promise.all([
    Promise.all([
      db.select().from(visitSystemsTable).orderBy(asc(visitSystemsTable.name)),
      db.select().from(visitContractorsTable).orderBy(asc(visitContractorsTable.name)),
      db.select().from(visitQualificationsTable),
      db.select().from(visitSiteApprovalsTable),
      db.select().from(visitRepresentativesTable).orderBy(asc(visitRepresentativesTable.fullName)),
      db.select().from(visitRepresentativeSystemsTable),
    ]),
    db.select({ visit: visitRequestsTable, metadata: visitRequestMetadataTable }).from(visitRequestsTable).leftJoin(visitRequestMetadataTable, eq(visitRequestMetadataTable.visitId, visitRequestsTable.id)).where(eq(visitRequestsTable.status, "pending")).orderBy(desc(visitRequestsTable.createdAt)).limit(100),
    buildAlerts(),
  ]);
  const [systems, contractors, qualifications, siteApprovals, representatives, representativeSystems] = catalogResponse;
  return res.json({
    systems: systems.map((row) => ({ ...row, displayName: canonicalSystemName(row.name) })),
    contractors: contractors.map((row) => ({ ...row, displayName: canonicalContractorName(row.name) })),
    qualifications,
    siteApprovals,
    representatives: representatives.map(({ identityNumber, mobile, ...row }) => ({ ...row, identityMasked: maskIdentity(identityNumber), mobileMasked: mobile ? `${mobile.slice(0, 3)}••••${mobile.slice(-3)}` : "—" })),
    representativeSystems,
    maintenanceContractors: MAINTENANCE_CONTRACTORS,
    approvedSubcontractors: approvedCatalogResponse(systems, contractors),
    approvedPersonnel: approvedPersonnelResponse(systems, contractors),
    pending: pending.map((row) => sanitizeVisit(row.visit, row.metadata)),
    alerts,
    stats: { pending: pending.length, systems: systems.filter((x) => x.isActive).length, contractors: contractors.filter((x) => x.isActive).length, representatives: representatives.filter((x) => x.isActive).length },
  });
});

router.post("/management/systems", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const name = cleanText(req.body?.name, 200); if (!name) return res.status(400).json({ error: "اسم النظام مطلوب" });
  try {
    const [row] = await db.insert(visitSystemsTable).values({ name, code: cleanText(req.body.code, 80) || null, description: cleanText(req.body.description, 1_000) || null, createdByUserId: req.currentUser.id }).returning();
    await audit(req, "إضافة نظام زيارات", { systemId: row.id, name });
    return res.status(201).json({ system: row });
  } catch { return res.status(409).json({ error: "اسم النظام مستخدم من قبل" }); }
});

router.patch("/management/systems/:id", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم غير صالح" });
  const [row] = await db.update(visitSystemsTable).set({ name: cleanText(req.body.name, 200) || undefined, code: req.body.code === undefined ? undefined : cleanText(req.body.code, 80) || null, description: req.body.description === undefined ? undefined : cleanText(req.body.description, 1_000) || null, isActive: req.body.isActive === undefined ? undefined : !!req.body.isActive, updatedAt: new Date() }).where(eq(visitSystemsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "النظام غير موجود" });
  await audit(req, "تعديل نظام زيارات", { systemId: id, isActive: row.isActive });
  return res.json({ system: row });
});

router.post("/management/contractors", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const name = cleanText(req.body?.name, 200); if (!name) return res.status(400).json({ error: "اسم الشركة مطلوب" });
  const mobile = cleanText(req.body.contactMobile, 30);
  if (mobile && !isValidSaudiMobile(mobile)) return res.status(400).json({ error: "رقم الجوال غير صالح" });
  try {
    const [row] = await db.insert(visitContractorsTable).values({ name, registrationNumber: cleanText(req.body.registrationNumber, 100) || null, contactName: cleanText(req.body.contactName, 200) || null, contactMobile: mobile || null, createdByUserId: req.currentUser.id }).returning();
    await audit(req, "إضافة شركة مقاول باطن", { contractorId: row.id, name });
    return res.status(201).json({ contractor: row });
  } catch { return res.status(409).json({ error: "اسم الشركة مستخدم من قبل" }); }
});

router.patch("/management/contractors/:id", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم غير صالح" });
  const mobile = req.body.contactMobile === undefined ? undefined : cleanText(req.body.contactMobile, 30);
  if (mobile && !isValidSaudiMobile(mobile)) return res.status(400).json({ error: "رقم الجوال غير صالح" });
  const [row] = await db.update(visitContractorsTable).set({ name: cleanText(req.body.name, 200) || undefined, registrationNumber: req.body.registrationNumber === undefined ? undefined : cleanText(req.body.registrationNumber, 100) || null, contactName: req.body.contactName === undefined ? undefined : cleanText(req.body.contactName, 200) || null, contactMobile: mobile === undefined ? undefined : mobile || null, isActive: req.body.isActive === undefined ? undefined : !!req.body.isActive, updatedAt: new Date() }).where(eq(visitContractorsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "الشركة غير موجودة" });
  await audit(req, "تعديل شركة مقاول باطن", { contractorId: id, isActive: row.isActive });
  return res.json({ contractor: row });
});

router.post("/management/direct-setup", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const systemId = numberId(req.body.systemId), existingContractorId = numberId(req.body.contractorId);
  const includeQualification = req.body.includeQualification === true;
  const maintenance = maintenanceContractor(req.body.maintenanceContractorKey);
  const siteName = cleanText(req.body.siteName, 200);
  const dates = validDateRange(req.body.validFrom, req.body.validUntil);
  const companyName = canonicalContractorName(req.body.companyName);
  const contactMobile = cleanText(req.body.contactMobile, 30);
  if (!maintenance || !siteName || !(maintenance.sites as readonly string[]).includes(siteName)) return res.status(400).json({ error: "اختر مقاول الصيانة والموقع الصحيحين أولًا" });
  if (!systemId || !dates) return res.status(400).json({ error: "النظام وبداية ونهاية اعتماد الموقع الصحيحة مطلوبة" });
  if (!existingContractorId && !isFullCompanyName(companyName)) return res.status(400).json({ error: "اكتب الاسم الرسمي الكامل ويبدأ بكلمة شركة أو مؤسسة أو مصنع" });
  if (contactMobile && !isValidSaudiMobile(contactMobile)) return res.status(400).json({ error: "رقم جوال الشركة غير صالح" });
  try {
    const result = await db.transaction(async (tx) => {
      const [system] = await tx.select().from(visitSystemsTable).where(and(eq(visitSystemsTable.id, systemId), eq(visitSystemsTable.isActive, true))).limit(1);
      if (!system) throw new Error("SYSTEM_NOT_FOUND");
      let contractor: any;
      if (existingContractorId) {
        [contractor] = await tx.select().from(visitContractorsTable).where(and(eq(visitContractorsTable.id, existingContractorId), eq(visitContractorsTable.isActive, true))).limit(1);
        if (!contractor) throw new Error("CONTRACTOR_NOT_FOUND");
      } else {
        [contractor] = await tx.insert(visitContractorsTable).values({
          name: companyName,
          registrationNumber: cleanText(req.body.registrationNumber, 100) || null,
          contactName: cleanText(req.body.contactName, 200) || null,
          contactMobile: contactMobile || null,
          createdByUserId: req.currentUser.id,
        }).returning();
      }
      let qualification: any = null;
      if (includeQualification) {
        [qualification] = await tx.insert(visitQualificationsTable).values({
          contractorId: contractor.id,
          systemId,
          validFrom: dates.validFrom,
          validUntil: dates.validUntil,
          status: "active",
          notes: cleanText(req.body.notes, 1_000) || "استكمال يدوي اختياري من الإصدار المباشر",
        }).onConflictDoUpdate({
          target: [visitQualificationsTable.contractorId, visitQualificationsTable.systemId],
          set: { validFrom: dates.validFrom, validUntil: dates.validUntil, status: "active", notes: cleanText(req.body.notes, 1_000) || "استكمال يدوي اختياري من الإصدار المباشر", updatedAt: new Date() },
        }).returning();
      }
      const [siteApproval] = await tx.insert(visitSiteApprovalsTable).values({
        siteName,
        contractorId: contractor.id,
        systemId,
        validFrom: dates.validFrom,
        validUntil: dates.validUntil,
        status: "active",
        notes: cleanText(req.body.notes, 1_000) || "اعتماد موقع من الإصدار المباشر",
      }).onConflictDoUpdate({
        target: [visitSiteApprovalsTable.siteName, visitSiteApprovalsTable.systemId, visitSiteApprovalsTable.contractorId],
        set: { validFrom: dates.validFrom, validUntil: dates.validUntil, status: "active", notes: cleanText(req.body.notes, 1_000) || "اعتماد موقع من الإصدار المباشر", updatedAt: new Date() },
      }).returning();
      return { contractor, qualification, siteApproval, system };
    });
    await audit(req, existingContractorId ? "استكمال اعتماد موقع من الإصدار المباشر" : "إضافة شركة واعتماد موقعها من الإصدار المباشر", {
      contractorId: result.contractor.id,
      systemId,
      siteName,
      qualificationIncluded: includeQualification,
      validFrom: dates.validFrom,
      validUntil: dates.validUntil,
    });
    return res.status(existingContractorId ? 200 : 201).json({
      contractor: { id: result.contractor.id, name: canonicalContractorName(result.contractor.name) },
      qualification: result.qualification,
      siteApproval: result.siteApproval,
    });
  } catch (err: any) {
    if (err?.message === "SYSTEM_NOT_FOUND") return res.status(404).json({ error: "النظام غير موجود أو معطل" });
    if (err?.message === "CONTRACTOR_NOT_FOUND") return res.status(404).json({ error: "الشركة غير موجودة أو معطلة" });
    if (err?.code === "23505" || String(err?.message).includes("unique")) return res.status(409).json({ error: "اسم الشركة مستخدم من قبل؛ اخترها ثم استكمل اعتماد الموقع" });
    req.log.error({ err }, "Direct visit catalogue setup failed");
    return res.status(500).json({ error: "تعذر استكمال الشركة واعتماد الموقع" });
  }
});

router.post("/management/legacy-representatives/preview", requireAuth, requireApproved, requireClusterVisitManagement, legacyDocxUploadMemory.array("files", 40), async (req: any, res) => {
  const files = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
  if (!files.length) return res.status(400).json({ error: "اختر ملف Word واحدًا على الأقل من النظام القديم" });
  if (files.reduce((total, file) => total + file.size, 0) > 30 * 1024 * 1024) return res.status(413).json({ error: "إجمالي ملفات Word يتجاوز 30MB" });
  try {
    const records = files.flatMap((file) => parseLegacyRepresentativeDocx(file));
    if (!records.length) return res.status(400).json({ error: "لم يتم العثور على بيانات مناديب صالحة" });
    const now = Date.now();
    for (const [key, preview] of legacyRepresentativePreviews) if (preview.expiresAt <= now) legacyRepresentativePreviews.delete(key);
    const previewToken = randomBytes(24).toString("base64url");
    const expiresAt = now + 15 * 60_000;
    legacyRepresentativePreviews.set(previewToken, { expiresAt, uploadedBy: req.currentUser.id, records });
    const cleanupTimer = setTimeout(() => {
      const current = legacyRepresentativePreviews.get(previewToken);
      if (current?.expiresAt === expiresAt) legacyRepresentativePreviews.delete(previewToken);
    }, 15 * 60_000 + 1_000);
    cleanupTimer.unref();
    await audit(req, "معاينة استيراد مناديب من مستندات النظام القديم", { files: files.length, representatives: records.length });
    return res.json({
      previewToken,
      expiresInSeconds: 900,
      rows: records.map((record, index) => ({
        index,
        sourceFile: record.sourceFile,
        fullName: record.fullName,
        identityMasked: maskIdentity(record.identityNumber),
        mobileMasked: `${record.mobile.slice(0, 3)}••••${record.mobile.slice(-3)}`,
        companyName: record.companyName,
        suggestedSystemName: record.suggestedSystemName,
      })),
    });
  } catch (err: any) {
    req.log.warn({ err: err?.message }, "Legacy representative DOCX preview rejected");
    return res.status(400).json({ error: cleanText(err?.message, 300) || "تعذر قراءة ملفات Word القديمة" });
  }
});

router.post("/management/legacy-representatives/confirm", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const previewToken = cleanText(req.body?.previewToken, 200);
  const selectedRows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const preview = legacyRepresentativePreviews.get(previewToken);
  if (!preview || preview.expiresAt <= Date.now() || preview.uploadedBy !== req.currentUser.id) {
    legacyRepresentativePreviews.delete(previewToken);
    return res.status(410).json({ error: "انتهت معاينة ملفات النظام القديم؛ أعد رفع الملفات" });
  }
  if (selectedRows.length > preview.records.length) return res.status(400).json({ error: "عدد الصفوف المحددة أكبر من المعاينة الأصلية" });
  const selectionByIndex = new Map<number, number | null>();
  for (const row of selectedRows) {
    const index = Number(row?.index);
    if (Number.isInteger(index) && index >= 0 && index < preview.records.length) selectionByIndex.set(index, numberId(row?.systemId));
  }
  const selections = [...selectionByIndex].map(([index, systemId]) => ({ index, systemId }));
  if (!selections.length || selections.some((row: any) => !row.systemId)) return res.status(400).json({ error: "حدد النظام لكل مندوب تريد استيراده" });
  const confirmedSelections = selections.map((row) => ({ index: row.index, systemId: row.systemId as number }));
  try {
    const summary = await db.transaction(async (tx) => {
      const systemIds = [...new Set(confirmedSelections.map((row) => row.systemId))];
      const systems = await tx.select({ id: visitSystemsTable.id }).from(visitSystemsTable)
        .where(and(inArray(visitSystemsTable.id, systemIds), eq(visitSystemsTable.isActive, true)));
      if (systems.length !== systemIds.length) throw new Error("LEGACY_SYSTEM_NOT_FOUND");
      const contractors = await tx.select().from(visitContractorsTable);
      const contractorByKey = firstCanonicalRowMap(contractors, canonicalContractorName);
      let representativesCreated = 0, representativesUpdated = 0, contractorsCreated = 0;
      for (const selection of confirmedSelections) {
        const record = preview.records[selection.index];
        const contractorKey = catalogNameKey(canonicalContractorName(record.companyName));
        let contractor = contractorByKey.get(contractorKey);
        if (!contractor) {
          const [created] = await tx.insert(visitContractorsTable).values({ name: canonicalContractorName(record.companyName), createdByUserId: req.currentUser.id }).returning();
          contractor = created;
          contractorByKey.set(contractorKey, created);
          contractorsCreated += 1;
        } else if (!contractor.isActive) {
          [contractor] = await tx.update(visitContractorsTable).set({ isActive: true, updatedAt: new Date() }).where(eq(visitContractorsTable.id, contractor.id)).returning();
          contractorByKey.set(contractorKey, contractor);
        }
        const saved = await upsertRepresentative(tx, {
          contractorId: contractor.id,
          fullName: record.fullName,
          identityNumber: record.identityNumber,
          mobile: record.mobile,
          residenceExpiresAt: null,
          noResidenceException: false,
          exceptionReason: null,
        });
        if (saved.created) representativesCreated += 1; else representativesUpdated += 1;
        await tx.insert(visitRepresentativeSystemsTable).values({ representativeId: saved.row.id, systemId: selection.systemId, isActive: true })
          .onConflictDoUpdate({ target: [visitRepresentativeSystemsTable.representativeId, visitRepresentativeSystemsTable.systemId], set: { isActive: true } });
      }
      return { imported: confirmedSelections.length, representativesCreated, representativesUpdated, contractorsCreated };
    });
    legacyRepresentativePreviews.delete(previewToken);
    await audit(req, "استيراد مناديب وربطهم بالأنظمة من مستندات النظام القديم", summary);
    return res.status(201).json(summary);
  } catch (err: any) {
    if (err?.message === "LEGACY_SYSTEM_NOT_FOUND") return res.status(400).json({ error: "أحد الأنظمة المحددة غير موجود أو معطل؛ حدّث الصفحة وأعد المعاينة" });
    if (err?.message === "IDENTITY_BELONGS_TO_OTHER_CONTRACTOR") return res.status(409).json({ error: "توجد هوية مرتبطة بشركة مختلفة؛ راجع ملف المندوب قبل الاستيراد", code: "REPRESENTATIVE_CONTRACTOR_MISMATCH" });
    return respondVisitMutationError(req, res, err, "تعذر استيراد مناديب النظام القديم؛ لم يتم حفظ أي صف", "يوجد مندوب مكرر في الملفات المختارة");
  }
});

router.post("/management/direct-representative", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const contractorId = numberId(req.body.contractorId), systemId = numberId(req.body.systemId);
  const fullName = cleanText(req.body.fullName, 200), identityNumber = cleanText(req.body.identityNumber, 40).replace(/\s+/g, ""), mobile = cleanText(req.body.mobile, 30);
  const noResidenceException = req.body.noResidenceException === true;
  const exceptionReason = cleanText(req.body.exceptionReason, 1_000);
  const residenceExpiresAt = dayString(req.body.residenceExpiresAt);
  if (!contractorId || !systemId || !fullName) return res.status(400).json({ error: "اختر الشركة والنظام واكتب اسم المندوب" });
  if (!/^\d{10}$/.test(identityNumber)) return res.status(400).json({ error: "رقم الهوية أو الإقامة يجب أن يتكون من 10 أرقام" });
  if (!isValidSaudiMobile(mobile)) return res.status(400).json({ error: "رقم الجوال السعودي غير صالح" });
  if (noResidenceException && !exceptionReason) return res.status(400).json({ error: "سبب الاستثناء بدون إقامة مطلوب" });
  try {
    const result = await db.transaction(async (tx) => {
      const [[contractor], [system]] = await Promise.all([
        tx.select({ id: visitContractorsTable.id }).from(visitContractorsTable).where(and(eq(visitContractorsTable.id, contractorId), eq(visitContractorsTable.isActive, true))).limit(1),
        tx.select({ id: visitSystemsTable.id }).from(visitSystemsTable).where(and(eq(visitSystemsTable.id, systemId), eq(visitSystemsTable.isActive, true))).limit(1),
      ]);
      if (!contractor || !system) throw new Error("CENTRAL_REFERENCE_NOT_FOUND");
      const saved = await upsertRepresentative(tx, {
        contractorId,
        fullName,
        identityNumber,
        mobile,
        residenceExpiresAt,
        noResidenceException,
        exceptionReason: noResidenceException ? exceptionReason : null,
      });
      await tx.insert(visitRepresentativeSystemsTable).values({ representativeId: saved.row.id, systemId, isActive: true })
        .onConflictDoUpdate({
          target: [visitRepresentativeSystemsTable.representativeId, visitRepresentativeSystemsTable.systemId],
          set: { isActive: true },
        });
      return saved;
    });
    await audit(req, result.created ? "إضافة مندوب وربطه بالنظام من الإصدار المباشر" : "تحديث مندوب وإعادة ربطه بالنظام من الإصدار المباشر", { representativeId: result.row.id, contractorId, systemId, noResidenceException, exceptionReason: noResidenceException ? exceptionReason : null });
    return res.status(result.created ? 201 : 200).json({
      representative: {
        id: result.row.id,
        contractorId,
        fullName: result.row.fullName,
        identityMasked: maskIdentity(result.row.identityNumber),
        residenceExpiresAt: result.row.residenceExpiresAt,
        noResidenceException: result.row.noResidenceException,
        isActive: result.row.isActive,
      },
      reusedExisting: !result.created,
    });
  } catch (err: any) {
    if (err?.message === "CENTRAL_REFERENCE_NOT_FOUND") return res.status(404).json({ error: "الشركة أو النظام غير موجود أو معطل" });
    if (err?.message === "IDENTITY_BELONGS_TO_OTHER_CONTRACTOR") return res.status(409).json({ error: "رقم الهوية أو الإقامة مرتبط بشركة أخرى؛ افتح المندوب الموجود وراجع الشركة", code: "REPRESENTATIVE_CONTRACTOR_MISMATCH" });
    return respondVisitMutationError(req, res, err, "تعذر حفظ المندوب وربطه بالنظام؛ حدّث الصفحة ثم أعد المحاولة", "رقم الهوية أو الإقامة مسجل من قبل");
  }
});

router.post("/management/direct-representative-link", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const representativeId = numberId(req.body.representativeId), contractorId = numberId(req.body.contractorId), systemId = numberId(req.body.systemId);
  if (!representativeId || !contractorId || !systemId) return res.status(400).json({ error: "اختر المندوب المسجل والشركة والنظام" });
  try {
    const representative = await db.transaction(async (tx) => {
      const [[row], [system]] = await Promise.all([
        tx.select().from(visitRepresentativesTable).where(and(
          eq(visitRepresentativesTable.id, representativeId),
          eq(visitRepresentativesTable.contractorId, contractorId),
          eq(visitRepresentativesTable.isActive, true),
        )).limit(1),
        tx.select({ id: visitSystemsTable.id }).from(visitSystemsTable).where(and(eq(visitSystemsTable.id, systemId), eq(visitSystemsTable.isActive, true))).limit(1),
      ]);
      if (!row) throw new Error("REPRESENTATIVE_NOT_IN_CONTRACTOR");
      if (!system) throw new Error("SYSTEM_NOT_FOUND");
      await tx.insert(visitRepresentativeSystemsTable).values({ representativeId, systemId, isActive: true })
        .onConflictDoUpdate({
          target: [visitRepresentativeSystemsTable.representativeId, visitRepresentativeSystemsTable.systemId],
          set: { isActive: true },
        });
      return row;
    });
    await audit(req, "ربط مندوب مسجل بنظام من الإصدار المباشر", { representativeId, contractorId, systemId });
    return res.json({
      representative: {
        id: representative.id,
        contractorId: representative.contractorId,
        fullName: representative.fullName,
        identityMasked: maskIdentity(representative.identityNumber),
        residenceExpiresAt: representative.residenceExpiresAt,
        noResidenceException: representative.noResidenceException,
        isActive: representative.isActive,
      },
      linked: true,
    });
  } catch (err: any) {
    if (err?.message === "REPRESENTATIVE_NOT_IN_CONTRACTOR") return res.status(409).json({ error: "المندوب غير مسجل ضمن الشركة المختارة؛ حدّث الصفحة وأعد الاختيار" });
    if (err?.message === "SYSTEM_NOT_FOUND") return res.status(404).json({ error: "النظام غير موجود أو معطل" });
    return respondVisitMutationError(req, res, err, "تعذر ربط المندوب المسجل بالنظام؛ حدّث الصفحة ثم أعد المحاولة");
  }
});

router.post("/management/qualifications", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const contractorId = numberId(req.body.contractorId), systemId = numberId(req.body.systemId);
  const validFrom = dayString(req.body.validFrom), validUntil = dayString(req.body.validUntil);
  if (!contractorId || !systemId || !validFrom || !validUntil || validUntil < validFrom) return res.status(400).json({ error: "بيانات التأهيل وتواريخه غير صالحة" });
  const [row] = await db.insert(visitQualificationsTable).values({ contractorId, systemId, validFrom, validUntil, notes: cleanText(req.body.notes, 1_000) || null })
    .onConflictDoUpdate({ target: [visitQualificationsTable.contractorId, visitQualificationsTable.systemId], set: { validFrom, validUntil, status: "active", notes: cleanText(req.body.notes, 1_000) || null, updatedAt: new Date() } }).returning();
  await audit(req, "حفظ تأهيل شركة لنظام", { qualificationId: row.id, contractorId, systemId, validFrom, validUntil });
  return res.json({ qualification: row });
});

router.patch("/management/qualifications/:id", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم غير صالح" });
  const status = cleanText(req.body.status, 20);
  if (!new Set(["active", "disabled", "expired"]).has(status)) return res.status(400).json({ error: "حالة التأهيل غير صالحة" });
  const [row] = await db.update(visitQualificationsTable).set({ status: status as any, notes: req.body.notes === undefined ? undefined : cleanText(req.body.notes, 1_000) || null, updatedAt: new Date() }).where(eq(visitQualificationsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "التأهيل غير موجود" });
  await audit(req, "تعديل حالة تأهيل", { qualificationId: id, status: row.status });
  return res.json({ qualification: row });
});

router.post("/management/site-approvals", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const siteName = cleanText(req.body.siteName, 200), contractorId = numberId(req.body.contractorId), systemId = numberId(req.body.systemId);
  const validFrom = dayString(req.body.validFrom), validUntil = dayString(req.body.validUntil);
  if (!siteName || !contractorId || !systemId || !validFrom || !validUntil || validUntil < validFrom) return res.status(400).json({ error: "بيانات اعتماد الموقع وتواريخه غير صالحة" });
  const [row] = await db.insert(visitSiteApprovalsTable).values({ siteName, contractorId, systemId, validFrom, validUntil, notes: cleanText(req.body.notes, 1_000) || null })
    .onConflictDoUpdate({ target: [visitSiteApprovalsTable.siteName, visitSiteApprovalsTable.systemId, visitSiteApprovalsTable.contractorId], set: { validFrom, validUntil, status: "active", notes: cleanText(req.body.notes, 1_000) || null, updatedAt: new Date() } }).returning();
  await audit(req, "حفظ اعتماد نظام وشركة لموقع", { siteApprovalId: row.id, siteName, contractorId, systemId });
  return res.json({ siteApproval: row });
});

router.patch("/management/site-approvals/:id", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم غير صالح" });
  const status = cleanText(req.body.status, 20);
  if (!new Set(["active", "disabled", "expired"]).has(status)) return res.status(400).json({ error: "حالة اعتماد الموقع غير صالحة" });
  const [row] = await db.update(visitSiteApprovalsTable).set({ status: status as any, notes: req.body.notes === undefined ? undefined : cleanText(req.body.notes, 1_000) || null, updatedAt: new Date() }).where(eq(visitSiteApprovalsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "اعتماد الموقع غير موجود" });
  await audit(req, "تعديل اعتماد موقع", { siteApprovalId: id, status: row.status });
  return res.json({ siteApproval: row });
});

router.post("/management/representatives", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const contractorId = numberId(req.body.contractorId), fullName = cleanText(req.body.fullName, 200), identityNumber = cleanText(req.body.identityNumber, 40).replace(/\s+/g, ""), mobile = cleanText(req.body.mobile, 30);
  const noResidenceException = req.body.noResidenceException === true;
  const exceptionReason = cleanText(req.body.exceptionReason, 1_000);
  const residenceExpiresAt = dayString(req.body.residenceExpiresAt);
  if (!contractorId || !fullName || !/^\d{10}$/.test(identityNumber) || !isValidSaudiMobile(mobile)) return res.status(400).json({ error: "اسم المندوب ورقم هوية أو إقامة من 10 أرقام وجوال سعودي صحيح مطلوبة" });
  if (noResidenceException && !exceptionReason) return res.status(400).json({ error: "سبب الاستثناء بدون إقامة مطلوب" });
  try {
    const result = await db.transaction(async (tx) => {
      const [contractor] = await tx.select({ id: visitContractorsTable.id }).from(visitContractorsTable)
        .where(and(eq(visitContractorsTable.id, contractorId), eq(visitContractorsTable.isActive, true))).limit(1);
      if (!contractor) throw new Error("CONTRACTOR_NOT_FOUND");
      return upsertRepresentative(tx, { contractorId, fullName, identityNumber, mobile, residenceExpiresAt, noResidenceException, exceptionReason: noResidenceException ? exceptionReason : null });
    });
    await audit(req, result.created ? "إضافة مندوب مقاول باطن" : "تحديث مندوب مقاول باطن مسجل", { representativeId: result.row.id, contractorId, noResidenceException, exceptionReason: noResidenceException ? exceptionReason : null });
    const { identityNumber: _identityNumber, ...safeRow } = result.row;
    return res.status(result.created ? 201 : 200).json({ representative: { ...safeRow, identityMasked: maskIdentity(result.row.identityNumber) }, reusedExisting: !result.created });
  } catch (err: any) {
    if (err?.message === "CONTRACTOR_NOT_FOUND") return res.status(404).json({ error: "الشركة غير موجودة أو معطلة" });
    if (err?.message === "IDENTITY_BELONGS_TO_OTHER_CONTRACTOR") return res.status(409).json({ error: "رقم الهوية أو الإقامة مرتبط بشركة أخرى؛ راجع المندوب الموجود", code: "REPRESENTATIVE_CONTRACTOR_MISMATCH" });
    return respondVisitMutationError(req, res, err, "تعذر حفظ المندوب؛ حدّث الصفحة ثم أعد المحاولة", "رقم الهوية أو الإقامة مسجل من قبل");
  }
});

router.patch("/management/representatives/:id", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم غير صالح" });
  const noResidenceException = req.body.noResidenceException;
  const exceptionReason = cleanText(req.body.exceptionReason, 1_000);
  if (noResidenceException === true && !exceptionReason) return res.status(400).json({ error: "سبب الاستثناء بدون إقامة مطلوب" });
  const mobile = req.body.mobile === undefined ? undefined : cleanText(req.body.mobile, 30);
  if (mobile && !isValidSaudiMobile(mobile)) return res.status(400).json({ error: "رقم الجوال غير صالح" });
  const [row] = await db.update(visitRepresentativesTable).set({ contractorId: numberId(req.body.contractorId) || undefined, fullName: cleanText(req.body.fullName, 200) || undefined, mobile, residenceExpiresAt: req.body.residenceExpiresAt === undefined ? undefined : dayString(req.body.residenceExpiresAt), noResidenceException: noResidenceException === undefined ? undefined : !!noResidenceException, exceptionReason: noResidenceException === true ? exceptionReason : (noResidenceException === false ? null : undefined), isActive: req.body.isActive === undefined ? undefined : !!req.body.isActive, updatedAt: new Date() }).where(eq(visitRepresentativesTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "المندوب غير موجود" });
  await audit(req, "تعديل مندوب مقاول باطن", { representativeId: id, isActive: row.isActive, noResidenceException: row.noResidenceException, exceptionReason: row.noResidenceException ? row.exceptionReason : null });
  return res.json({ representative: { ...row, identityNumber: undefined, identityMasked: maskIdentity(row.identityNumber) } });
});

router.put("/management/representatives/:id/systems", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const representativeId = numberId(req.params.id);
  const systemIds = [...new Set((Array.isArray(req.body.systemIds) ? req.body.systemIds : []).map(numberId).filter(Boolean))] as number[];
  if (!representativeId) return res.status(400).json({ error: "رقم المندوب غير صالح" });
  const current = await db.select().from(visitRepresentativeSystemsTable).where(eq(visitRepresentativeSystemsTable.representativeId, representativeId));
  const currentBySystem = new Map(current.map((row) => [row.systemId, row]));
  await db.transaction(async (tx) => {
    for (const row of current) if (!systemIds.includes(row.systemId) && row.isActive) await tx.update(visitRepresentativeSystemsTable).set({ isActive: false }).where(eq(visitRepresentativeSystemsTable.id, row.id));
    for (const systemId of systemIds) {
      const existing = currentBySystem.get(systemId);
      if (existing) await tx.update(visitRepresentativeSystemsTable).set({ isActive: true }).where(eq(visitRepresentativeSystemsTable.id, existing.id));
      else await tx.insert(visitRepresentativeSystemsTable).values({ representativeId, systemId, isActive: true });
    }
  });
  await audit(req, "ربط مندوب بأنظمة الزيارات", { representativeId, systemIds });
  return res.json({ representativeId, systemIds });
});

router.post("/management/copy-site/preview", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const sourceSite = cleanText(req.body.sourceSite, 200), targetSite = cleanText(req.body.targetSite, 200);
  if (!sourceSite || !targetSite || sourceSite === targetSite) return res.status(400).json({ error: "اختر موقع مصدر وموقع هدف مختلفين" });
  const approvals = await db.select({ approval: visitSiteApprovalsTable, system: visitSystemsTable, contractor: visitContractorsTable })
    .from(visitSiteApprovalsTable)
    .innerJoin(visitSystemsTable, eq(visitSystemsTable.id, visitSiteApprovalsTable.systemId))
    .innerJoin(visitContractorsTable, eq(visitContractorsTable.id, visitSiteApprovalsTable.contractorId))
    .where(eq(visitSiteApprovalsTable.siteName, sourceSite));
  return res.json({ sourceSite, targetSite, rows: approvals.map((row) => ({ ...row.approval, systemName: row.system.name, contractorName: row.contractor.name })) });
});

router.post("/management/copy-site/confirm", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const sourceSite = cleanText(req.body.sourceSite, 200), targetSite = cleanText(req.body.targetSite, 200);
  const ids = [...new Set((Array.isArray(req.body.approvalIds) ? req.body.approvalIds : []).map(numberId).filter(Boolean))] as number[];
  if (!sourceSite || !targetSite || sourceSite === targetSite || !ids.length) return res.status(400).json({ error: "بيانات النسخ غير مكتملة" });
  const source = await db.select().from(visitSiteApprovalsTable).where(and(eq(visitSiteApprovalsTable.siteName, sourceSite), inArray(visitSiteApprovalsTable.id, ids)));
  await db.transaction(async (tx) => {
    for (const row of source) await tx.insert(visitSiteApprovalsTable).values({ siteName: targetSite, systemId: row.systemId, contractorId: row.contractorId, validFrom: row.validFrom, validUntil: row.validUntil, status: row.status, notes: row.notes })
      .onConflictDoUpdate({ target: [visitSiteApprovalsTable.siteName, visitSiteApprovalsTable.systemId, visitSiteApprovalsTable.contractorId], set: { validFrom: row.validFrom, validUntil: row.validUntil, status: row.status, notes: row.notes, updatedAt: new Date() } });
  });
  await audit(req, "نسخ إعدادات الأنظمة واعتماد الموقع", { sourceSite, targetSite, approvalIds: ids, copied: source.length });
  return res.json({ copied: source.length });
});

router.patch("/:id/link", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const visitId = numberId(req.params.id), systemId = numberId(req.body.systemId), contractorId = numberId(req.body.contractorId), representativeId = numberId(req.body.representativeId), siteApprovalId = numberId(req.body.siteApprovalId), qualificationId = numberId(req.body.qualificationId);
  if (!visitId || !systemId || !contractorId || !representativeId || !siteApprovalId || !qualificationId) return res.status(400).json({ error: "جميع روابط البيانات المركزية مطلوبة" });
  const purpose = DEFAULT_VISIT_PURPOSE;
  const window = validateVisitWindow(req.body.startsAt, req.body.endsAt);
  if ("error" in window) return res.status(400).json({ error: window.error });
  const values = { systemId, contractorId, representativeId, siteApprovalId, qualificationId, purpose, startsAt: window.startsAt, endsAt: window.endsAt, linkedAt: new Date(), linkedByUserId: req.currentUser.id, updatedAt: new Date() };
  try {
    const context = await db.transaction(async (tx) => {
      const [visit] = await tx.select({ id: visitRequestsTable.id, status: visitRequestsTable.status }).from(visitRequestsTable).where(eq(visitRequestsTable.id, visitId)).limit(1);
      if (!visit) throw new Error("VISIT_NOT_FOUND");
      if (visit.status === "cancelled") throw new Error("VISIT_CANCELLED");
      const [existing] = await tx.select({ id: visitRequestMetadataTable.id }).from(visitRequestMetadataTable).where(eq(visitRequestMetadataTable.visitId, visitId)).limit(1);
      if (existing) await tx.update(visitRequestMetadataTable).set(values).where(eq(visitRequestMetadataTable.visitId, visitId));
      else await tx.insert(visitRequestMetadataTable).values({ visitId, ...values });
      const linked = await getVisitContext(tx, visitId);
      if (!linked) throw new Error("VISIT_NOT_FOUND");
      const validationError = await validateCentralContext(tx, linked);
      if (validationError) throw new Error(`VALIDATION:${validationError}`);
      return linked;
    });
    await audit(req, "ربط طلب زيارة قديم بالكتالوج المركزي", { visitId, systemId, contractorId, representativeId, siteApprovalId, qualificationId });
    return res.json({ visit: sanitizeVisit(context.visit, context.metadata), validForApproval: true });
  } catch (err: any) {
    if (err?.message === "VISIT_NOT_FOUND") return res.status(404).json({ error: "الزيارة غير موجودة" });
    if (err?.message === "VISIT_CANCELLED") return res.status(409).json({ error: "لا يمكن تعديل زيارة ملغاة؛ استخدم إعادة الإصدار" });
    if (String(err?.message).startsWith("VALIDATION:")) return res.status(400).json({ error: String(err.message).slice(11) });
    req.log.error({ err }, "Visit central linking failed");
    return res.status(400).json({ error: "تعذر ربط الطلب؛ تحقق من المراجع المركزية المحددة" });
  }
});

router.patch("/:id/status", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم زيارة غير صالح" });
  const status = cleanText(req.body.status, 30);
  if (!new Set(["approved", "rejected", "pending"]).has(status)) return res.status(400).json({ error: "حالة غير صالحة" });
  try {
    const [existingVisit] = await db.select({ status: visitRequestsTable.status }).from(visitRequestsTable).where(eq(visitRequestsTable.id, id)).limit(1);
    if (!existingVisit) return res.status(404).json({ error: "الزيارة غير موجودة" });
    if (existingVisit.status === "cancelled") return res.status(409).json({ error: "لا يمكن تغيير قرار زيارة ملغاة؛ استخدم إعادة الإصدار" });
    let context: VisitContext | null = null;
    if (status === "approved") context = await db.transaction((tx) => approveVisit(tx, id, req.currentUser));
    else {
      const [updated] = await db.update(visitRequestsTable).set({ status: status as any, adminNotes: cleanText(req.body.adminNotes, 1_000) || null, updatedAt: new Date() }).where(and(eq(visitRequestsTable.id, id), ne(visitRequestsTable.status, "cancelled"))).returning();
      if (!updated) return res.status(409).json({ error: "لا يمكن تغيير قرار زيارة أُلغيت بالتزامن" });
      context = await getVisitContext(db, id);
    }
    if (!context) return res.status(404).json({ error: "الزيارة غير موجودة" });
    await audit(req, status === "approved" ? "اعتماد زيارة وإصدار تصريح" : status === "rejected" ? "رفض طلب زيارة" : "إعادة طلب زيارة للمراجعة", { visitId: id, status, serialNumber: context.visit.serialNumber || null, notes: cleanText(req.body.adminNotes, 1_000) || null });
    const [submitter] = context.visit.userId ? await db.select().from(usersTable).where(eq(usersTable.id, context.visit.userId)).limit(1) : [];
    if (submitter?.email && status === "approved") sendVisitApprovedEmail(submitter.email, submitter.name, { repName: context.visit.repName, siteLocation: context.visit.siteLocation, visitDate: String(context.visit.visitDate), serialNumber: context.visit.serialNumber || "—", approvedAt: new Date(context.visit.approvedAt).toLocaleDateString("ar-SA") }).catch(() => {});
    if (submitter?.email && status === "rejected") sendVisitRejectedEmail(submitter.email, submitter.name, { repName: context.visit.repName, siteLocation: context.visit.siteLocation, adminNotes: cleanText(req.body.adminNotes, 1_000) || null }).catch(() => {});
    return res.json({ visit: sanitizeVisit(context.visit, context.metadata) });
  } catch (err: any) {
    if (String(err?.message).startsWith("VALIDATION:")) return res.status(400).json({ error: String(err.message).slice(11) });
    if (err?.message === "VISIT_NOT_FOUND") return res.status(404).json({ error: "الزيارة غير موجودة" });
    if (err?.message === "VISIT_CANCELLED") return res.status(409).json({ error: "لا يمكن اعتماد زيارة ملغاة؛ استخدم إعادة الإصدار" });
    req.log.error({ err }, "Visit decision failed");
    return res.status(500).json({ error: "تعذر حفظ قرار الزيارة" });
  }
});

router.patch("/:id/cancel", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id), reason = cleanText(req.body.reason, 1_000);
  if (!id || !reason) return res.status(400).json({ error: "رقم الزيارة وسبب الإلغاء مطلوبان" });
  const [updated] = await db.update(visitRequestsTable).set({ status: "cancelled", cancelledAt: new Date(), cancelledReason: reason, updatedAt: new Date() }).where(eq(visitRequestsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "الزيارة غير موجودة" });
  await audit(req, "إلغاء زيارة دون حذفها", { visitId: id, reason });
  return res.json({ visit: sanitizeVisit(updated) });
});

router.delete("/:id", requireAuth, requireApproved, requireClusterVisitManagement, (_req, res) => res.status(405).json({ error: "الحذف النهائي للزيارات غير مسموح؛ استخدم الإلغاء" }));

router.post("/:id/reissue", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const originalId = numberId(req.params.id); if (!originalId) return res.status(400).json({ error: "رقم زيارة غير صالح" });
  const original = await getVisitContext(db, originalId); if (!original) return res.status(404).json({ error: "الزيارة الأصلية غير موجودة" });
  if (!original.metadata) return res.status(400).json({ error: "اربط الزيارة الأصلية بالبيانات المركزية قبل إعادة الإصدار" });
  const purpose = DEFAULT_VISIT_PURPOSE;
  const window = validateVisitWindow(req.body.startsAt, req.body.endsAt);
  if ("error" in window) return res.status(400).json({ error: window.error });
  try {
    const context = await db.transaction(async (tx) => {
      const [copy] = await tx.insert(visitRequestsTable).values({
        userId: original.visit.userId,
        repName: original.visit.repName,
        siteLocation: original.visit.siteLocation,
        repId: original.visit.repId,
        visitDate: window.startsAt.toISOString().slice(0, 10),
        repMobile: original.visit.repMobile,
        systemName: original.visit.systemName,
        mainContractor: original.visit.mainContractor,
        subContractor: original.visit.subContractor,
        status: "pending",
        submittedByName: original.visit.submittedByName,
        submittedByHospital: original.visit.submittedByHospital,
        submittedByContract: original.visit.submittedByContract,
        reissuedFromVisitId: originalId,
      }).returning();
      await tx.insert(visitRequestMetadataTable).values({
        visitId: copy.id,
        systemId: original.metadata.systemId,
        contractorId: original.metadata.contractorId,
        representativeId: original.metadata.representativeId,
        siteApprovalId: original.metadata.siteApprovalId,
        qualificationId: original.metadata.qualificationId,
        purpose,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        linkedAt: new Date(),
        linkedByUserId: req.currentUser.id,
      });
      await ensurePermitToken(tx, copy.id);
      return approveVisit(tx, copy.id, req.currentUser, { qualificationOptional: !original.metadata.qualificationId });
    });
    await audit(req, "إعادة إصدار تصريح زيارة", { originalVisitId: originalId, newVisitId: context.visit.id, newSerialNumber: context.visit.serialNumber });
    return res.status(201).json({ visit: sanitizeVisit(context.visit, context.metadata), originalVisitId: originalId });
  } catch (err: any) {
    if (String(err?.message).startsWith("VALIDATION:")) return res.status(400).json({ error: String(err.message).slice(11) });
    req.log.error({ err }, "Visit reissue failed");
    return res.status(500).json({ error: "تعذر إعادة إصدار الزيارة" });
  }
});

// ── Archive, alerts, documents and ZIP import ───────────────────────────────
router.get("/management/archive", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
  const conditions: any[] = [];
  if (cleanText(req.query.permitNumber, 100)) conditions.push(ilike(visitRequestsTable.serialNumber, `%${cleanText(req.query.permitNumber, 100)}%`));
  if (cleanText(req.query.visitorName, 200)) conditions.push(ilike(visitRequestsTable.repName, `%${cleanText(req.query.visitorName, 200)}%`));
  if (cleanText(req.query.company, 200)) conditions.push(ilike(visitRequestsTable.subContractor, `%${cleanText(req.query.company, 200)}%`));
  if (cleanText(req.query.system, 200)) conditions.push(ilike(visitRequestsTable.systemName, `%${cleanText(req.query.system, 200)}%`));
  if (cleanText(req.query.site, 200)) conditions.push(ilike(visitRequestsTable.siteLocation, `%${cleanText(req.query.site, 200)}%`));
  const requestedStatus = cleanText(req.query.status, 30);
  const today = new Date().toISOString().slice(0, 10);
  if (requestedStatus === "expired") conditions.push(and(eq(visitRequestsTable.status, "approved"), or(
    lte(visitRequestMetadataTable.endsAt, new Date()),
    and(isNull(visitRequestMetadataTable.endsAt), lt(visitRequestsTable.visitDate, today)),
  )));
  else if (requestedStatus === "active") conditions.push(and(eq(visitRequestsTable.status, "approved"), or(
    gte(visitRequestMetadataTable.endsAt, new Date()),
    and(isNull(visitRequestMetadataTable.endsAt), gte(visitRequestsTable.visitDate, today)),
  )));
  else if (requestedStatus) conditions.push(eq(visitRequestsTable.status, requestedStatus as any));
  const from = dayString(req.query.from), to = dayString(req.query.to);
  if (from) conditions.push(gte(visitRequestsTable.visitDate, from));
  if (to) conditions.push(lte(visitRequestsTable.visitDate, to));
  const where = conditions.length ? and(...conditions) : undefined;
  const base = db.select({ visit: visitRequestsTable, metadata: visitRequestMetadataTable }).from(visitRequestsTable).leftJoin(visitRequestMetadataTable, eq(visitRequestMetadataTable.visitId, visitRequestsTable.id));
  const countBase = db.select({ count: sql<number>`count(*)` }).from(visitRequestsTable).leftJoin(visitRequestMetadataTable, eq(visitRequestMetadataTable.visitId, visitRequestsTable.id));
  const [rows, countRows] = await Promise.all([
    (where ? base.where(where) : base).orderBy(desc(visitRequestsTable.createdAt)).limit(limit).offset((page - 1) * limit),
    where ? countBase.where(where) : countBase,
  ]);
  return res.json({ visits: rows.map((row) => sanitizeVisit(row.visit, row.metadata)), total: Number(countRows[0]?.count || 0), page, limit, pages: Math.ceil(Number(countRows[0]?.count || 0) / limit) });
});

async function buildAlerts() {
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [residences, qualifications, approvals] = await Promise.all([
    db.select({ id: visitRepresentativesTable.id, name: visitRepresentativesTable.fullName, date: visitRepresentativesTable.residenceExpiresAt }).from(visitRepresentativesTable).where(and(eq(visitRepresentativesTable.isActive, true), eq(visitRepresentativesTable.noResidenceException, false), lte(visitRepresentativesTable.residenceExpiresAt, soon))),
    db.select({ id: visitQualificationsTable.id, date: visitQualificationsTable.validUntil }).from(visitQualificationsTable).where(and(eq(visitQualificationsTable.status, "active"), lte(visitQualificationsTable.validUntil, soon))),
    db.select({ id: visitSiteApprovalsTable.id, site: visitSiteApprovalsTable.siteName, date: visitSiteApprovalsTable.validUntil }).from(visitSiteApprovalsTable).where(and(eq(visitSiteApprovalsTable.status, "active"), lte(visitSiteApprovalsTable.validUntil, soon))),
  ]);
  return [
    ...residences.map((x) => ({ type: "residence_expiry", title: x.date && x.date < today ? "إقامة منتهية" : "إقامة قاربت على الانتهاء", entityId: x.id, name: x.name, date: x.date })),
    ...qualifications.map((x) => ({ type: "qualification_expiry", title: x.date < today ? "تأهيل شركة منتهٍ" : "تأهيل شركة قارب على الانتهاء", entityId: x.id, date: x.date })),
    ...approvals.map((x) => ({ type: "site_approval_expiry", title: x.date < today ? "اعتماد موقع منتهٍ" : "اعتماد موقع قارب على الانتهاء", entityId: x.id, site: x.site, date: x.date })),
  ];
}

router.get("/management/alerts", requireAuth, requireApproved, requireClusterVisitManagement, async (_req, res) => res.json({ alerts: await buildAlerts() }));

router.post("/management/documents", requireAuth, requireApproved, requireClusterVisitManagement, uploadMemory.single("file"), async (req: any, res) => {
  const ownerType = cleanText(req.body.ownerType, 40), ownerId = numberId(req.body.ownerId), documentType = cleanText(req.body.documentType, 80);
  if (!req.file || !ownerId || !documentType || !new Set(["visit", "representative", "contractor", "qualification", "site_approval"]).has(ownerType)) return res.status(400).json({ error: "بيانات الوثيقة غير مكتملة" });
  if (!await visitDocumentOwnerExists(ownerType, ownerId)) return res.status(404).json({ error: "الجهة المرتبطة بالوثيقة غير موجودة" });
  try {
    const stored = await storeDocument(req, ownerType, ownerId, documentType, req.file);
    await audit(req, stored.replacedDocumentId ? "رفع بديل لوثيقة زيارة" : "رفع وثيقة زيارة", { documentId: stored.document.id, replacedDocumentId: stored.replacedDocumentId, ownerType, ownerId, documentType, sha256: stored.document.sha256 });
    return res.status(201).json({ document: { id: stored.document.id, ownerType, ownerId, documentType, originalName: stored.document.originalName, mimeType: stored.document.mimeType, sizeBytes: stored.document.sizeBytes, status: stored.document.status, createdAt: stored.document.createdAt }, replacedDocumentId: stored.replacedDocumentId });
  } catch (err: any) {
    if (err.message === "FILE_MAGIC_MISMATCH" || err.message === "FILE_MIME_MISMATCH") return res.status(415).json({ error: "نوع الملف الحقيقي لا يطابق PDF أو الصورة المسموح بها" });
    if (err.message === "DUPLICATE_DOCUMENT") return res.status(409).json({ error: "الملف نفسه مرفوع من قبل ولن يتم تكراره" });
    req.log.error({ err }, "Visit document upload failed");
    return res.status(500).json({ error: "تعذر حفظ الوثيقة" });
  }
});

router.get("/management/documents/:id/content", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم وثيقة غير صالح" });
  const [row] = await db.select({ document: visitDocumentsTable, content: visitDocumentContentsTable.content }).from(visitDocumentsTable).innerJoin(visitDocumentContentsTable, eq(visitDocumentContentsTable.documentId, visitDocumentsTable.id)).where(eq(visitDocumentsTable.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: "الوثيقة غير موجودة" });
  await audit(req, "تنزيل وثيقة زيارة محمية", { documentId: id, ownerType: row.document.ownerType, ownerId: row.document.ownerId });
  res.setHeader("Content-Type", row.document.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row.document.originalName)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.send(row.content);
});

router.patch("/management/documents/:id/disable", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id), reason = cleanText(req.body.reason, 1_000);
  if (!id || !reason) return res.status(400).json({ error: "رقم الوثيقة وسبب التعطيل مطلوبان" });
  const [row] = await db.update(visitDocumentsTable).set({ status: "disabled", disabledAt: new Date() }).where(and(eq(visitDocumentsTable.id, id), eq(visitDocumentsTable.status, "active"))).returning();
  if (!row) return res.status(404).json({ error: "الوثيقة غير موجودة أو غير مفعلة" });
  await audit(req, "تعطيل وثيقة زيارة دون حذفها", { documentId: id, reason });
  return res.json({ document: { id: row.id, status: row.status, disabledAt: row.disabledAt } });
});

router.patch("/:id/signed-permit", requireAuth, requireApproved, requireClusterVisitManagement, uploadMemory.single("file"), async (req: any, res) => {
  const id = numberId(req.params.id); if (!id || !req.file) return res.status(400).json({ error: "الزيارة والملف مطلوبان" });
  const [visit] = await db.select({ id: visitRequestsTable.id }).from(visitRequestsTable).where(eq(visitRequestsTable.id, id)).limit(1);
  if (!visit) return res.status(404).json({ error: "الزيارة غير موجودة" });
  try {
    const stored = await storeDocument(req, "visit", id, "signed_permit", req.file);
    await db.update(visitRequestsTable).set({ signedPermitFile: `document:${stored.document.id}`, updatedAt: new Date() }).where(eq(visitRequestsTable.id, id));
    await audit(req, "رفع نسخة تصريح زيارة موقعة", { visitId: id, documentId: stored.document.id, replacedDocumentId: stored.replacedDocumentId });
    return res.json({ visitId: id, documentId: stored.document.id, replacedDocumentId: stored.replacedDocumentId });
  } catch (err: any) {
    if (err.message === "FILE_MAGIC_MISMATCH" || err.message === "FILE_MIME_MISMATCH") return res.status(415).json({ error: "نوع الملف الحقيقي غير مسموح" });
    if (err.message === "DUPLICATE_DOCUMENT") return res.status(409).json({ error: "النسخة نفسها مرفوعة من قبل" });
    return res.status(500).json({ error: "تعذر حفظ النسخة الموقعة" });
  }
});

router.get("/:id/signed-permit", requireAuth, requireApproved, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم زيارة غير صالح" });
  const context = await getVisitContext(db, id); if (!context) return res.status(404).json({ error: "الزيارة غير موجودة" });
  if (!await canAccessVisit(req.currentUser, context.visit)) return res.status(403).json({ error: "غير مصرح بعرض النسخة الموقعة" });
  const [stored] = await db.select({ document: visitDocumentsTable, content: visitDocumentContentsTable.content })
    .from(visitDocumentsTable)
    .innerJoin(visitDocumentContentsTable, eq(visitDocumentContentsTable.documentId, visitDocumentsTable.id))
    .where(and(eq(visitDocumentsTable.ownerType, "visit"), eq(visitDocumentsTable.ownerId, id), eq(visitDocumentsTable.documentType, "signed_permit"), eq(visitDocumentsTable.status, "active")))
    .orderBy(desc(visitDocumentsTable.createdAt)).limit(1);
  let content: Buffer | null = stored?.content || null;
  let mimeType = stored?.document.mimeType || "application/octet-stream";
  let filename = stored?.document.originalName || `signed-visit-${id}`;
  if (!content && typeof context.visit.signedPermitFile === "string" && context.visit.signedPermitFile.startsWith("data:")) {
    const match = context.visit.signedPermitFile.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
    if (match) { mimeType = match[1]; content = Buffer.from(match[2], "base64"); filename = `legacy-signed-visit-${id}`; }
  }
  if (!content) return res.status(404).json({ error: "لا توجد نسخة موقعة محفوظة" });
  await audit(req, "عرض نسخة تصريح زيارة موقعة", { visitId: id, documentId: stored?.document.id || null, legacy: !stored });
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.send(content);
});

router.post("/management/import/preview", requireAuth, requireApproved, requireClusterVisitManagement, zipUploadMemory.single("file"), async (req: any, res) => {
  if (!req.file || req.file.buffer.subarray(0, 2).toString("ascii") !== "PK") return res.status(415).json({ error: "يجب رفع ملف ZIP حقيقي" });
  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    const { totalExpandedBytes } = validateZipEntries(entries);
    const records = parseZipRecords(zip);
    const previewToken = randomBytes(24).toString("base64url");
    const digest = sha256(req.file.buffer);
    const entryNames = entries.filter((entry) => !entry.isDirectory).map((entry) => entry.entryName);
    zipPreviews.set(previewToken, { expiresAt: Date.now() + 15 * 60_000, sha: digest, records, entries: entryNames, uploadedBy: req.currentUser.id });
    return res.json({ previewToken, sha256: digest, files: entryNames, totalExpandedBytes, counts: Object.fromEntries(Object.entries(records).map(([key, rows]) => [key, rows.length])), expiresInSeconds: 900 });
  } catch (err: any) {
    return res.status(400).json({ error: cleanText(err.message, 500) || "ملف ZIP غير آمن أو غير صالح" });
  }
});

router.post("/management/import/confirm", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const previewToken = cleanText(req.body.previewToken, 200), expectedSha = cleanText(req.body.sha256, 64);
  const preview = zipPreviews.get(previewToken);
  if (!preview || preview.expiresAt < Date.now() || preview.uploadedBy !== req.currentUser.id || preview.sha !== expectedSha) return res.status(400).json({ error: "معاينة الاستيراد غير صالحة أو انتهت" });
  try {
    const counts = await importZipRecords(preview.records, req.currentUser.id);
    zipPreviews.delete(previewToken);
    await audit(req, "تأكيد استيراد ZIP لبيانات الزيارات", { sha256: preview.sha, files: preview.entries, counts });
    return res.json({ imported: counts });
  } catch (err) {
    req.log.error({ err }, "Visit ZIP confirm failed");
    return res.status(400).json({ error: "تعذر استيراد البيانات؛ لم يتم حفظ جزء من العملية" });
  }
});

// ── Permit preview, QR issue/rotation and camera verification ───────────────
router.get("/:id/permit", requireAuth, requireApproved, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم زيارة غير صالح" });
  const context = await getVisitContext(db, id); if (!context) return res.status(404).json({ error: "الزيارة غير موجودة" });
  if (!await canAccessVisit(req.currentUser, context.visit)) return res.status(403).json({ error: "غير مصرح بعرض التصريح" });
  try {
    const qr = await db.transaction((tx) => ensurePermitToken(tx, id));
    const token = decryptPermitToken(qr.tokenCiphertext);
    const origin = `${req.protocol}://${req.get("host")}`;
    const qrDataUrl = await QRCode.toDataURL(`${origin}/original-viewer?page=cluster-subcontractor-visits.html&visitQr=${encodeURIComponent(token)}&download=1`, { errorCorrectionLevel: "M", margin: 1, width: 220 });
    const [stamp, signature, signerName, signerTitle, legacyManagerName, documentsVerified] = await Promise.all([
      getSetting("visit_stamp"),
      getSetting("visit_signature"),
      getSetting("visit_signer_name"),
      getSetting("visit_signer_title"),
      getSetting("visit_manager_name"),
      hasActiveVisitDocuments(id, context.metadata),
    ]);
    await audit(req, context.visit.status === "approved" ? "معاينة تصريح زيارة" : "معاينة مسودة تصريح زيارة", { visitId: id, serialNumber: context.visit.serialNumber || null });
    return res.json({
      permit: {
        ...sanitizeVisit(context.visit, context.metadata),
        repIdMasked: maskIdentity(context.visit.repId),
        representativeName: context.representative?.fullName || context.visit.repName,
        residenceVerified: isResidenceVerified(context.representative, context.visit),
        documentsVerified,
        isDraft: context.visit.status !== "approved",
        qrDataUrl,
      },
      settings: {
        stamp,
        signature,
        signerName: signerName || legacyManagerName || DEFAULT_VISIT_SIGNER_NAME,
        signerTitle: signerTitle || DEFAULT_VISIT_SIGNER_TITLE,
        managerName: signerName || legacyManagerName || DEFAULT_VISIT_SIGNER_NAME,
      },
    });
  } catch (err: any) {
    req.log.error({ err }, "Permit preview failed");
    return res.status(503).json({ error: err.message === "VISIT_QR_SECRET_OR_CLERK_SECRET_KEY_REQUIRED" ? "مفتاح QR غير مهيأ على الخادم" : "تعذر تجهيز التصريح" });
  }
});

router.post("/:id/qr/rotate", requireAuth, requireApproved, requireClusterVisitManagement, async (req: any, res) => {
  const id = numberId(req.params.id); if (!id) return res.status(400).json({ error: "رقم زيارة غير صالح" });
  await db.transaction(async (tx) => {
    await tx.update(visitPermitTokensTable).set({ status: "disabled", disabledAt: new Date() }).where(and(eq(visitPermitTokensTable.visitId, id), eq(visitPermitTokensTable.status, "active")));
    await ensurePermitToken(tx, id);
  });
  await audit(req, "تعطيل رمز تصريح وإصدار رمز جديد", { visitId: id, reason: cleanText(req.body.reason, 1_000) || null });
  return res.json({ visitId: id, rotated: true });
});

async function verifyToken(req: any, token: string) {
  const tokenHash = sha256(token);
  const [row] = await db.select({ qr: visitPermitTokensTable, visit: visitRequestsTable, metadata: visitRequestMetadataTable, representative: visitRepresentativesTable })
    .from(visitPermitTokensTable)
    .innerJoin(visitRequestsTable, eq(visitRequestsTable.id, visitPermitTokensTable.visitId))
    .leftJoin(visitRequestMetadataTable, eq(visitRequestMetadataTable.visitId, visitRequestsTable.id))
    .leftJoin(visitRepresentativesTable, eq(visitRepresentativesTable.id, visitRequestMetadataTable.representativeId))
    .where(eq(visitPermitTokensTable.tokenHash, tokenHash)).limit(1);
  if (!row || !tokenHashesMatch(token, row.qr.tokenHash) || row.qr.status !== "active") return null;
  await db.update(visitPermitTokensTable).set({ lastScannedAt: new Date(), scanCount: sql`${visitPermitTokensTable.scanCount} + 1` }).where(eq(visitPermitTokensTable.id, row.qr.id));
  const full = hasClusterVisitManagement(req.currentUser);
  const documentsVerified = full ? await hasActiveVisitDocuments(row.visit.id, row.metadata) : undefined;
  return {
    full,
    visit: {
      id: full ? row.visit.id : undefined,
      serialNumber: row.visit.serialNumber,
      status: visitEffectiveStatus(row.visit, row.metadata),
      visitorName: full ? row.visit.repName : shortenVisitorName(row.visit.repName),
      repIdMasked: full ? maskIdentity(row.visit.repId) : undefined,
      company: full ? canonicalContractorName(row.visit.subContractor) : undefined,
      system: full ? canonicalSystemName(row.visit.systemName) : undefined,
      site: row.visit.siteLocation,
      visitDate: row.visit.visitDate,
      startsAt: full ? row.metadata?.startsAt || null : undefined,
      endsAt: full ? row.metadata?.endsAt || null : undefined,
      representativeName: full ? row.representative?.fullName || row.visit.repName : undefined,
      residenceVerified: full ? isResidenceVerified(row.representative, row.visit) : undefined,
      documentsVerified,
      cancellationReason: full ? row.visit.cancelledReason : undefined,
      exceptionReason: full && row.representative?.noResidenceException ? row.representative.exceptionReason : undefined,
      canOpenFull: full,
      hasSignedPermit: full ? !!row.visit.signedPermitFile : undefined,
    },
  };
}

router.post("/qr/verify", requireAuth, requireApproved, async (req: any, res) => {
  if (!assertScanRate(req, res)) return;
  const token = cleanText(req.body.token, 300);
  if (!token) return res.status(400).json({ error: "رمز التحقق مطلوب" });
  const result = await verifyToken(req, token);
  await audit(req, "مسح QR لتصريح زيارة", { result: result ? result.visit.status : "invalid", visitId: result?.full ? result.visit.id : null });
  if (!result) return res.status(404).json({ error: "رمز التصريح غير صالح أو معطل" });
  return res.json(result);
});

router.get("/qr/verify-link", requireAuth, requireApproved, async (req: any, res) => {
  if (!assertScanRate(req, res)) return;
  const token = cleanText(req.query.token, 300);
  const result = token ? await verifyToken(req, token) : null;
  await audit(req, "فتح رابط QR لتصريح زيارة", { result: result ? result.visit.status : "invalid", visitId: result?.full ? result.visit.id : null });
  if (!result) return res.status(404).json({ error: "رمز التصريح غير صالح أو معطل" });
  return res.json(result);
});

router.get("/qr/manual", requireAuth, requireApproved, async (req: any, res) => {
  if (!assertScanRate(req, res)) return;
  const serial = cleanText(req.query.serialNumber, 100);
  if (!serial) return res.status(400).json({ error: "رقم التصريح مطلوب" });
  const [row] = await db.select({ visit: visitRequestsTable, metadata: visitRequestMetadataTable, representative: visitRepresentativesTable })
    .from(visitRequestsTable)
    .leftJoin(visitRequestMetadataTable, eq(visitRequestMetadataTable.visitId, visitRequestsTable.id))
    .leftJoin(visitRepresentativesTable, eq(visitRepresentativesTable.id, visitRequestMetadataTable.representativeId))
    .where(eq(visitRequestsTable.serialNumber, serial)).limit(1);
  await audit(req, "بحث يدوي عن تصريح زيارة", { serialNumber: serial, found: !!row });
  if (!row) return res.status(404).json({ error: "رقم التصريح غير موجود" });
  const full = hasClusterVisitManagement(req.currentUser);
  const documentsVerified = full ? await hasActiveVisitDocuments(row.visit.id, row.metadata) : undefined;
  return res.json({ full, visit: { id: full ? row.visit.id : undefined, serialNumber: row.visit.serialNumber, status: visitEffectiveStatus(row.visit, row.metadata), visitorName: full ? row.visit.repName : shortenVisitorName(row.visit.repName), repIdMasked: full ? maskIdentity(row.visit.repId) : undefined, company: full ? canonicalContractorName(row.visit.subContractor) : undefined, system: full ? canonicalSystemName(row.visit.systemName) : undefined, site: row.visit.siteLocation, visitDate: row.visit.visitDate, startsAt: full ? row.metadata?.startsAt : undefined, endsAt: full ? row.metadata?.endsAt : undefined, representativeName: full ? row.representative?.fullName || row.visit.repName : undefined, residenceVerified: full ? isResidenceVerified(row.representative, row.visit) : undefined, documentsVerified, cancellationReason: full ? row.visit.cancelledReason : undefined, exceptionReason: full && row.representative?.noResidenceException ? row.representative.exceptionReason : undefined, canOpenFull: full, hasSignedPermit: full ? !!row.visit.signedPermitFile : undefined } });
});

export default router;
