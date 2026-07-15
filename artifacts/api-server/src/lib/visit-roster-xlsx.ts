import AdmZip from "adm-zip";
import { validateZipEntries } from "./visit-security.js";

export type RepresentativeRosterRecord = {
  sourceRow: number;
  visitNumber: string | null;
  fullName: string;
  identityNumber: string;
  mobile: string;
  siteName: string | null;
  visitDate: string | null;
  systemName: string;
  contractorName: string;
  sourceFile: string | null;
};

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`(?:^|\\s)${escaped}=(?:"([^"]*)"|'([^']*)')`));
  return match ? decodeXml(match[1] ?? match[2] ?? "") : null;
}

function textNodes(xml: string): string {
  return [...xml.matchAll(/<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)].map((match) => decodeXml(match[1])).join("");
}

function columnIndex(reference: string): number {
  const letters = (reference.match(/^[A-Z]+/i)?.[0] || "").toUpperCase();
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}

function headerKey(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim()
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function cleanText(value: unknown, max = 250): string {
  return String(value ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function asciiDigits(value: unknown): string {
  return String(value ?? "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[^\d+]/g, "");
}

function excelDate(value: unknown): string | null {
  const text = cleanText(value, 40);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const serial = Number(text);
  if (!Number.isFinite(serial) || serial < 1 || serial > 200000) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000).toISOString().slice(0, 10);
}

function workbookSheetPath(zip: AdmZip, targetSheetName: string): string {
  const contentTypes = zip.getEntry("[Content_Types].xml")?.getData().toString("utf8") || "";
  if (!contentTypes.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")) throw new Error("ROSTER_NOT_XLSX");
  const workbookXml = zip.getEntry("xl/workbook.xml")?.getData().toString("utf8") || "";
  const workbookRels = zip.getEntry("xl/_rels/workbook.xml.rels")?.getData().toString("utf8") || "";
  const sheetTag = [...workbookXml.matchAll(/<(?:[\w.-]+:)?sheet\b[^>]*>/g)].map((match) => match[0])
    .find((tag) => cleanText(attribute(tag, "name")) === targetSheetName);
  const relationId = sheetTag ? attribute(sheetTag, "r:id") : null;
  if (!relationId) throw new Error("ROSTER_SHEET_NOT_FOUND");
  const relationTag = [...workbookRels.matchAll(/<(?:[\w.-]+:)?Relationship\b[^>]*>/g)].map((match) => match[0])
    .find((tag) => attribute(tag, "Id") === relationId);
  const target = relationTag ? attribute(relationTag, "Target") : null;
  if (!target) throw new Error("ROSTER_SHEET_NOT_FOUND");
  const normalized = target.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("../")) throw new Error("ROSTER_UNSAFE_PATH");
  return normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
}

function worksheetRows(zip: AdmZip, sheetPath: string): string[][] {
  const sharedXml = zip.getEntry("xl/sharedStrings.xml")?.getData().toString("utf8") || "";
  const sharedStrings = [...sharedXml.matchAll(/<(?:[\w.-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?si>/g)].map((match) => textNodes(match[1]));
  const sheetXml = zip.getEntry(sheetPath)?.getData().toString("utf8") || "";
  if (!sheetXml) throw new Error("ROSTER_SHEET_NOT_FOUND");
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<(?:[\w.-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?row>/g)) {
    const rowNumber = Number(attribute(`<row ${rowMatch[1]}>`, "r") || rows.length + 1);
    const cells: string[] = [];
    for (const cellMatch of rowMatch[2].matchAll(/<(?:[\w.-]+:)?c\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?c>/g)) {
      const cellTag = `<c ${cellMatch[1]}>`;
      const index = columnIndex(attribute(cellTag, "r") || "A1");
      const type = attribute(cellTag, "t") || "n";
      const value = cellMatch[2].match(/<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/)?.[1] || "";
      cells[index] = type === "s" ? sharedStrings[Number(value)] || "" : type === "inlineStr" ? textNodes(cellMatch[2]) : decodeXml(value);
    }
    while (rows.length < rowNumber - 1) rows.push([]);
    rows[rowNumber - 1] = cells;
  }
  return rows;
}

export function parseRepresentativeRosterXlsx(buffer: Buffer): RepresentativeRosterRecord[] {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error("ROSTER_NOT_XLSX");
  let zip: AdmZip;
  try { zip = new AdmZip(buffer); } catch { throw new Error("ROSTER_NOT_XLSX"); }
  validateZipEntries(zip.getEntries());
  const rows = worksheetRows(zip, workbookSheetPath(zip, "المندوبون"));
  const requiredHeaders = ["اسمالمندوب", "رقمالهويهالاقامه", "رقمالجوال", "النظام", "مقاولالباطن"];
  const headerIndex = rows.findIndex((row) => {
    const keys = row.map(headerKey);
    return requiredHeaders.every((required) => keys.includes(required));
  });
  if (headerIndex < 0) throw new Error("ROSTER_HEADERS_NOT_FOUND");
  const headers = rows[headerIndex].map(headerKey);
  const indexOf = (key: string) => headers.indexOf(key);
  const indexes = {
    visitNumber: indexOf("رقمالزياره"),
    fullName: indexOf("اسمالمندوب"),
    identityNumber: indexOf("رقمالهويهالاقامه"),
    mobile: indexOf("رقمالجوال"),
    siteName: indexOf("الموقع"),
    visitDate: indexOf("تاريخالزياره"),
    systemName: indexOf("النظام"),
    contractorName: indexOf("مقاولالباطن"),
    sourceFile: indexOf("ملفالمصدر"),
  };
  const records: RepresentativeRosterRecord[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const fullName = cleanText(row[indexes.fullName], 200);
    const identityNumber = asciiDigits(row[indexes.identityNumber]);
    const mobile = asciiDigits(row[indexes.mobile]);
    const systemName = cleanText(row[indexes.systemName], 250);
    const contractorName = cleanText(row[indexes.contractorName], 250);
    if (!fullName && !identityNumber && !mobile && !systemName && !contractorName) continue;
    if (!fullName || !/^\d{10}$/.test(identityNumber) || !/^(?:\+?9665|05)\d{8}$/.test(mobile) || !systemName || !contractorName) throw new Error(`ROSTER_INVALID_ROW:${rowIndex + 1}`);
    records.push({
      sourceRow: rowIndex + 1,
      visitNumber: indexes.visitNumber >= 0 ? cleanText(row[indexes.visitNumber], 40) || null : null,
      fullName,
      identityNumber,
      mobile,
      siteName: indexes.siteName >= 0 ? cleanText(row[indexes.siteName], 250) || null : null,
      visitDate: indexes.visitDate >= 0 ? excelDate(row[indexes.visitDate]) : null,
      systemName,
      contractorName,
      sourceFile: indexes.sourceFile >= 0 ? cleanText(row[indexes.sourceFile], 250) || null : null,
    });
  }
  if (!records.length || records.length > 500) throw new Error("ROSTER_ROW_COUNT_INVALID");
  const identities = new Map<string, RepresentativeRosterRecord>();
  for (const record of records) {
    const existing = identities.get(record.identityNumber);
    if (existing && (existing.fullName !== record.fullName || existing.mobile !== record.mobile || headerKey(existing.contractorName) !== headerKey(record.contractorName))) {
      throw new Error(`ROSTER_IDENTITY_CONFLICT:${record.sourceRow}`);
    }
    if (!existing) identities.set(record.identityNumber, record);
  }
  return records;
}
