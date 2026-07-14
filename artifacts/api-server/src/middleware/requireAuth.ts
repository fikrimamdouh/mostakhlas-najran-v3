import { createClerkClient, verifyToken } from "@clerk/backend";

export const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function requireAuth(req: any, res: any, next: any) {
  const log = req.log ?? console;
  res.setHeader("Cache-Control", "no-store");

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    log.warn?.({ path: req.path, method: req.method }, "requireAuth: missing Authorization header");
    return res.status(401).json({ error: "انتهت جلسة الدخول؛ جدّد الجلسة ثم أعد المحاولة", code: "AUTH_HEADER_MISSING" });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    log.error?.({ path: req.path }, "requireAuth: CLERK_SECRET_KEY env var is not set");
    return res.status(500).json({ error: "تعذر التحقق من جلسة الدخول بسبب إعداد ناقص في الخادم", code: "AUTH_SERVER_MISCONFIGURED" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return res.status(401).json({ error: "انتهت جلسة الدخول؛ جدّد الجلسة ثم أعد المحاولة", code: "AUTH_TOKEN_MISSING" });

  try {
    const payload = await verifyToken(token, { secretKey });
    req.auth = { userId: payload.sub };
    req.clerkUserId = payload.sub;
    next();
  } catch (err: any) {
    log.warn?.({ path: req.path, method: req.method, errMsg: err?.message }, "requireAuth: token verification failed");
    return res.status(401).json({
      error: "انتهت صلاحية جلسة الدخول أو لم تعد صالحة؛ جدّد الجلسة ثم أعد المحاولة",
      code: "AUTH_TOKEN_INVALID",
    });
  }
}
