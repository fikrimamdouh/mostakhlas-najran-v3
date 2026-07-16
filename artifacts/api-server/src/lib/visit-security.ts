import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";

export const CLUSTER_VISIT_PERMISSION = "cluster_visit_management";
export const MAX_VISIT_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_VISIT_ZIP_BYTES = 25 * 1024 * 1024;
export const MAX_VISIT_ZIP_EXPANDED_BYTES = 100 * 1024 * 1024;
export const MAX_VISIT_ZIP_ENTRIES = 500;

export function parseAllowedModules(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function hasClusterVisitManagement(user: { allowedModules?: unknown } | null | undefined): boolean {
  return !!user && parseAllowedModules(user.allowedModules).includes(CLUSTER_VISIT_PERMISSION);
}

export function maskIdentity(value: unknown): string {
  const normalized = String(value ?? "").replace(/\s+/g, "");
  if (!normalized) return "—";
  if (normalized.length <= 4) return "•".repeat(normalized.length);
  return `${normalized.slice(0, 2)}${"•".repeat(Math.min(8, normalized.length - 4))}${normalized.slice(-2)}`;
}

export function shortenVisitorName(value: unknown): string {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || "—";
  return `${parts[0]} ${parts.at(-1)?.slice(0, 1) ?? ""}.`;
}

export function isValidSaudiMobile(value: unknown): boolean {
  return /^(?:\+?9665|05)\d{8}$/.test(String(value ?? "").replace(/[\s-]/g, ""));
}

export function parseIsoDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendarDay = new Date(Date.UTC(year, month - 1, day));
  if (calendarDay.getUTCFullYear() !== year || calendarDay.getUTCMonth() !== month - 1 || calendarDay.getUTCDate() !== day) return null;
  const date = new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isDateWithin(target: Date, validFrom: unknown, validUntil: unknown): boolean {
  const from = parseIsoDate(String(validFrom ?? ""));
  const until = parseIsoDate(String(validUntil ?? ""));
  if (!from || !until) return false;
  const day = target.toISOString().slice(0, 10);
  return day >= from.toISOString().slice(0, 10) && day <= until.toISOString().slice(0, 10);
}

export function validateVisitWindow(startsAt: unknown, endsAt: unknown): { startsAt: Date; endsAt: Date | null } | { error: string } {
  const start = parseIsoDate(startsAt);
  if (!start) return { error: "تاريخ الزيارة مطلوب بصيغة صحيحة" };
  if (endsAt === undefined || endsAt === null || String(endsAt).trim() === "") {
    return { startsAt: start, endsAt: null };
  }
  const end = parseIsoDate(endsAt);
  if (!end) return { error: "تاريخ نهاية الزيارة غير صالح" };
  if (end.getTime() <= start.getTime()) return { error: "تاريخ نهاية الزيارة يجب أن يكون بعد بداية الزيارة" };
  if (end.getTime() - start.getTime() > 7 * 24 * 60 * 60 * 1000) return { error: "مدة الزيارة لا يمكن أن تتجاوز سبعة أيام" };
  return { startsAt: start, endsAt: end };
}

export type AcceptedVisitFile = { mimeType: "application/pdf" | "image/jpeg" | "image/png"; extension: "pdf" | "jpg" | "png" };

export function detectVisitFile(buffer: Buffer): AcceptedVisitFile | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { mimeType: "application/pdf", extension: "pdf" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png" };
  }
  return null;
}

export function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export type ZipEntryLike = { entryName: string; header?: { size?: number; compressedSize?: number }; isDirectory?: boolean };

export function validateZipEntries(entries: ZipEntryLike[]): { totalExpandedBytes: number } {
  if (entries.length > MAX_VISIT_ZIP_ENTRIES) throw new Error("ملف ZIP يحتوي على عدد ملفات أكبر من الحد المسموح");
  let totalExpandedBytes = 0;
  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, "/");
    const safe = path.posix.normalize(normalized);
    if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || safe === ".." || safe.startsWith("../")) {
      throw new Error("ملف ZIP يحتوي على مسار غير آمن");
    }
    const expanded = Number(entry.header?.size ?? 0);
    const compressed = Number(entry.header?.compressedSize ?? 0);
    if (!Number.isFinite(expanded) || expanded < 0) throw new Error("حجم ملف غير صالح داخل ZIP");
    if (compressed > 0 && expanded / compressed > 100) throw new Error("ملف ZIP مضغوط بصورة خطرة");
    totalExpandedBytes += expanded;
    if (totalExpandedBytes > MAX_VISIT_ZIP_EXPANDED_BYTES) throw new Error("الحجم بعد فك ضغط ZIP يتجاوز الحد المسموح");
  }
  return { totalExpandedBytes };
}

function getTokenSecret(): Buffer {
  const raw = process.env.VISIT_QR_SECRET || process.env.CLERK_SECRET_KEY;
  if (!raw) throw new Error("VISIT_QR_SECRET_OR_CLERK_SECRET_KEY_REQUIRED");
  return createHash("sha256").update(raw).digest();
}

export function createPermitToken(): { token: string; tokenHash: string; tokenCiphertext: string } {
  const token = randomBytes(32).toString("base64url");
  const key = getTokenSecret();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    token,
    tokenHash: sha256(token),
    tokenCiphertext: Buffer.concat([iv, tag, ciphertext]).toString("base64url"),
  };
}

export function decryptPermitToken(tokenCiphertext: string): string {
  const packed = Buffer.from(tokenCiphertext, "base64url");
  if (packed.length < 29) throw new Error("INVALID_TOKEN_CIPHERTEXT");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getTokenSecret(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function tokenHashesMatch(token: string, expectedHex: string): boolean {
  if (!/^[a-f\d]{64}$/i.test(expectedHex)) return false;
  const actual = Buffer.from(sha256(token), "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createPermitDownloadToken(tokenHash: string): string {
  if (!/^[a-f\d]{64}$/i.test(tokenHash)) throw new Error("INVALID_PERMIT_TOKEN_HASH");
  const normalizedHash = tokenHash.toLowerCase();
  const signature = createHmac("sha256", getTokenSecret()).update(`permit-download:${normalizedHash}`).digest("base64url");
  return `${normalizedHash}.${signature}`;
}

export function verifyPermitDownloadToken(value: string): string | null {
  const match = value.match(/^([a-f\d]{64})\.([A-Za-z0-9_-]{43})$/i);
  if (!match) return null;
  const tokenHash = match[1].toLowerCase();
  const actual = Buffer.from(match[2], "utf8");
  const expected = Buffer.from(createHmac("sha256", getTokenSecret()).update(`permit-download:${tokenHash}`).digest("base64url"), "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? tokenHash : null;
}

export function sanitizeFilename(name: unknown): string {
  const base = path.basename(String(name || "document")).replace(/[^\p{L}\p{N}._ -]/gu, "_");
  return base.slice(0, 160) || "document";
}

export function visitEffectiveStatus(visit: { status?: string | null; visitDate?: unknown }, metadata?: { startsAt?: unknown; endsAt?: unknown } | null): string {
  if (visit.status === "cancelled") return "cancelled";
  if (visit.status === "rejected") return "rejected";
  if (visit.status !== "approved") return "pending";
  const now = Date.now();
  const start = metadata?.startsAt ? new Date(metadata.startsAt as any).getTime() : parseIsoDate(String(visit.visitDate ?? ""))?.getTime();
  const end = metadata?.endsAt ? new Date(metadata.endsAt as any).getTime() : (start ? start + 24 * 60 * 60 * 1000 : NaN);
  if (Number.isFinite(end) && now > end!) return "expired";
  return "active";
}
