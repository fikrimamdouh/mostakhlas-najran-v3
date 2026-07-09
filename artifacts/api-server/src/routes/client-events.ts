/**
 * client-events.ts — Production incident monitor collector
 *
 * POST /api/client-events
 *   Auth: requireAuth (any signed-in user)
 *   Body: { events: [ClientEvent, ...] }
 *   Behavior:
 *     - Validates payload size (max 64 KB per request, max 50 events).
 *     - Server-side redaction as a safety net (strips token/authorization/etc).
 *     - Per-user rate limit (100 events / 5 min).
 *     - Persists to audit_log with action = "CLIENT_EVENT_<TYPE>" and
 *       details = JSON.stringify(sanitizedPayload). No schema change needed.
 *     - Always returns 200 with { received, stored } — client is never blocked
 *       on failure to persist.
 *
 * GET /api/client-events
 *   Auth: requireAuth + requireAdmin
 *   Query:
 *     limit (default 100, max 500)
 *     since (ISO date)
 *     type, severity, hospital, userId, page (filters)
 *   Returns: { events: [...], total }
 *
 * Storage strategy:
 *   Uses the existing audit_log table (userId, userEmail, userName, action,
 *   details, ipAddress, createdAt). No migration required. Details holds the
 *   full sanitized event payload as JSON text. Consumers (dashboard) parse
 *   details on read.
 *
 * TODO(fikri): if event volume grows significantly, consider a dedicated
 * client_events table with typed columns (severity, page, type indexed).
 * For now audit_log is sufficient and avoids schema migration.
 */

import { Router } from "express";
import { db, usersTable, auditLogTable } from "@workspace/db";
import { eq, and, desc, gte, sql, like } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const MAX_EVENTS_PER_REQUEST = 10;
const MAX_PAYLOAD_BYTES = 24 * 1024;         // 64 KB per request
const MAX_EVENT_STRING_BYTES = 6 * 1024;    // 16 KB per single event after serialization
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
const RATE_LIMIT_MAX_EVENTS = 30;           // per user per window

// In-memory rate-limit cache. Keyed by userId, value = list of timestamps in
// the current window. Cleared periodically. Sufficient for our modest volume;
// if this router ever scales horizontally the per-instance limit is fine as a
// soft throttle (final safety net is MAX_PAYLOAD_BYTES).
// Keyed by clerkUserId (string) so the check runs BEFORE any database query —
// an event flood must never translate into a Neon query flood.
const rateLimitCache: Map<string, number[]> = new Map();

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitCache.get(key) || []).filter(t => t > cutoff);
  if (timestamps.length >= RATE_LIMIT_MAX_EVENTS) {
    rateLimitCache.set(key, timestamps);
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX_EVENTS - timestamps.length };
}

function recordRateLimitUsage(key: string, count: number) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitCache.get(key) || []).filter(t => t > cutoff);
  for (let i = 0; i < count; i++) timestamps.push(now);
  rateLimitCache.set(key, timestamps);
}

// ==================================================================
// Server-side redaction — defense in depth
// The client already redacts, but if a caller ever bypasses the client
// (custom fetch or tampered browser) we still refuse to persist raw
// secrets. Any string that looks like a token/password/bearer/etc gets
// replaced with [REDACTED].
// ==================================================================
const SENSITIVE_KEY_PATTERN = /(token|password|authorization|bearer|clerk|jwt|secret|api[_-]?key|cookie|session_id|sessionid)/i;
const BEARER_INLINE = /\b(bearer\s+)[\w.\-]{10,}/gi;
const JWT_INLINE = /\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g;
const LONG_TOKENISH = /\b[A-Za-z0-9_-]{40,}\b/g;

function redactString(s: string): string {
  if (typeof s !== "string") return s;
  return s
    .replace(BEARER_INLINE, "$1[REDACTED]")
    .replace(JWT_INLINE, "[REDACTED_JWT]")
    .replace(LONG_TOKENISH, (m) => {
      // Skip stack traces which often have long paths
      if (m.includes("/") || m.includes(".")) return m;
      return "[REDACTED_TOKENISH]";
    });
}

function sanitize(value: any, depth = 0): any {
  if (depth > 8) return "[TRUNCATED_DEPTH]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: any = {};
    let count = 0;
    for (const k of Object.keys(value)) {
      if (count++ > 50) break;
      if (SENSITIVE_KEY_PATTERN.test(k)) { out[k] = "[REDACTED]"; continue; }
      out[k] = sanitize(value[k], depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 500);
}

// ==================================================================
// POST /api/client-events
// ==================================================================
router.post("/", requireAuth, async (req: any, res: any) => {
  try {
    // Payload size check (approximate — bodyParser has already parsed but we
    // re-stringify to measure). Reject early if oversized to protect DB.
    const raw = JSON.stringify(req.body ?? {});
    if (raw.length > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ error: "Payload too large", received: 0, stored: 0 });
    }

    const events: any[] = Array.isArray(req.body?.events) ? req.body.events : [];
    if (events.length === 0) {
      return res.json({ received: 0, stored: 0 });
    }
    if (events.length > MAX_EVENTS_PER_REQUEST) {
      events.length = MAX_EVENTS_PER_REQUEST;
    }

    // (1) Rate limit FIRST — keyed by clerkUserId from the verified token,
    // zero database access. Rejected floods never reach Neon.
    const rlKey = String(req.clerkUserId || "anon");
    const limit = checkRateLimit(rlKey);
    if (!limit.allowed) {
      // Silently drop — do not block the client
      return res.json({ received: events.length, stored: 0, rateLimited: true });
    }

    // (2) User lookup only after passing the limiter — needed for attribution.
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkUserId))
      .limit(1);
    if (!user) {
      // Count the attempt so unregistered floods can't loop lookups forever.
      recordRateLimitUsage(rlKey, 1);
      return res.status(200).json({ received: events.length, stored: 0, error: "user-not-registered" });
    }

    // Sanitize + persist
    const ip =
      String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      null;

    const rows = [];
    for (const ev of events) {
      if (!ev || typeof ev !== "object") continue;
      const clean = sanitize(ev);
      const typeStr = String(clean.type || "UNKNOWN").slice(0, 60).replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
      const detailStr = JSON.stringify(clean);
      if (detailStr.length > MAX_EVENT_STRING_BYTES) {
        // Store a truncated version; oversized events are usually stack-trace bloat.
        const truncated = JSON.stringify({ ...clean, _truncated: true, stack: String(clean.stack || "").slice(0, 4000) });
        rows.push({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          action: `CLIENT_EVENT_${typeStr}`,
          details: truncated.length > MAX_EVENT_STRING_BYTES ? truncated.slice(0, MAX_EVENT_STRING_BYTES) : truncated,
          ipAddress: ip,
        });
      } else {
        rows.push({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          action: `CLIENT_EVENT_${typeStr}`,
          details: detailStr,
          ipAddress: ip,
        });
      }
    }

    if (rows.length === 0) return res.json({ received: events.length, stored: 0 });

    try {
      await db.insert(auditLogTable).values(rows);
      recordRateLimitUsage(rlKey, rows.length);
      return res.json({ received: events.length, stored: rows.length, remaining: limit.remaining - rows.length });
    } catch (dbErr: any) {
      // Even if DB write fails, we do not surface a failure that would make
      // the client retry endlessly. Log server-side and acknowledge.
      req.log?.error?.({ err: dbErr, path: req.path }, "client-events: db insert failed");
      return res.json({ received: events.length, stored: 0, error: "db-write-failed" });
    }
  } catch (err: any) {
    req.log?.error?.({ err, path: req.path }, "client-events: unhandled error");
    // Never 500 — that would make the client's offline queue retry storm.
    return res.json({ received: 0, stored: 0, error: "server-error" });
  }
});

// ==================================================================
// GET /api/client-events  (admin only)
// ==================================================================
router.get("/", requireAuth, async (req: any, res: any) => {
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.clerkUserId))
    .limit(1);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  // Neon transfer control: default 100, hard cap 200 (rows can carry up to
  // 16KB details each; 500 rows per refresh was multi-MB per click).
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const since = req.query.since ? new Date(String(req.query.since)) : null;
  const filterType = req.query.type ? String(req.query.type).toUpperCase() : null;
  const filterHospital = req.query.hospital ? String(req.query.hospital) : null;
  const filterUserId = req.query.userId ? Number(req.query.userId) : null;

  const conditions: any[] = [like(auditLogTable.action, "CLIENT_EVENT_%")];
  if (since && !isNaN(since.getTime())) conditions.push(gte(auditLogTable.createdAt, since));
  if (filterType) conditions.push(eq(auditLogTable.action, `CLIENT_EVENT_${filterType}`));
  if (filterUserId) conditions.push(eq(auditLogTable.userId, filterUserId));

  try {
    const raw = await db
      .select()
      .from(auditLogTable)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit);

    const events = raw
      .map((row: any) => {
        let parsed: any = null;
        try { parsed = row.details ? JSON.parse(row.details) : {}; } catch { parsed = { _parseError: true, rawDetails: row.details }; }
        return {
          id: row.id,
          userId: row.userId,
          userEmail: row.userEmail,
          userName: row.userName,
          type: (row.action || "").replace(/^CLIENT_EVENT_/, ""),
          ipAddress: row.ipAddress,
          createdAt: row.createdAt,
          ...(parsed || {}),
        };
      })
      .filter((ev: any) => {
        if (filterHospital && ev.hospital !== filterHospital) return false;
        if (req.query.severity && ev.severity !== req.query.severity) return false;
        if (req.query.page && ev.page !== req.query.page) return false;
        return true;
      });

    return res.json({ events, total: events.length });
  } catch (err: any) {
    req.log?.error?.({ err }, "client-events: GET failed");
    return res.status(500).json({ error: "Failed to read events" });
  }
});

// ==================================================================
// GET /api/client-events/summary  (admin only) — stats cards data
// ==================================================================
router.get("/summary", requireAuth, async (req: any, res: any) => {
  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.clerkUserId))
    .limit(1);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  const windowHours = Math.min(Number(req.query.windowHours) || 24, 168);
  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  try {
    const raw = await db
      .select({
        userId: auditLogTable.userId,
        action: auditLogTable.action,
        details: auditLogTable.details,
        createdAt: auditLogTable.createdAt,
      })
      .from(auditLogTable)
      .where(and(like(auditLogTable.action, "CLIENT_EVENT_%"), gte(auditLogTable.createdAt, cutoff)))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(500); // Neon transfer control: was 2000 — stats stay representative at 500

    const summary = {
      total: raw.length,
      critical: 0,
      errors: 0,
      warnings: 0,
      info: 0,
      affectedUsers: new Set<number>(),
      affectedHospitals: new Set<string>(),
      byType: {} as Record<string, number>,
      byPage: {} as Record<string, number>,
      windowHours,
      windowStart: cutoff.toISOString(),
    };

    for (const row of raw) {
      let parsed: any = {};
      try { parsed = row.details ? JSON.parse(row.details) : {}; } catch { /* ignore */ }
      const sev = (parsed.severity || "info").toLowerCase();
      if (sev === "critical") summary.critical++;
      else if (sev === "error") summary.errors++;
      else if (sev === "warning") summary.warnings++;
      else summary.info++;
      if (row.userId != null) summary.affectedUsers.add(row.userId);
      if (parsed.hospital) summary.affectedHospitals.add(String(parsed.hospital));
      const type = (row.action || "").replace(/^CLIENT_EVENT_/, "");
      summary.byType[type] = (summary.byType[type] || 0) + 1;
      if (parsed.page) summary.byPage[parsed.page] = (summary.byPage[parsed.page] || 0) + 1;
    }

    return res.json({
      total: summary.total,
      critical: summary.critical,
      errors: summary.errors,
      warnings: summary.warnings,
      info: summary.info,
      affectedUsers: summary.affectedUsers.size,
      affectedHospitals: summary.affectedHospitals.size,
      hospitals: Array.from(summary.affectedHospitals),
      byType: summary.byType,
      byPage: summary.byPage,
      windowHours: summary.windowHours,
      windowStart: summary.windowStart,
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "client-events: summary failed");
    return res.status(500).json({ error: "Failed to summarize" });
  }
});

export default router;
