import { createClerkClient, verifyToken } from "@clerk/backend";

export const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function requireAuth(req: any, res: any, next: any) {
  const log = req.log ?? console;

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    log.warn?.({ path: req.path, method: req.method }, "requireAuth: missing Authorization header");
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    log.error?.({ path: req.path }, "requireAuth: CLERK_SECRET_KEY env var is not set");
    return res.status(500).json({ error: "Server misconfiguration: CLERK_SECRET_KEY not set" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await verifyToken(token, { secretKey });
    req.auth = { userId: payload.sub };
    req.clerkUserId = payload.sub;
    next();
  } catch (err: any) {
    log.warn?.({ path: req.path, method: req.method, errMsg: err?.message }, "requireAuth: token verification failed");
    return res.status(401).json({
      error: "Invalid token",
      detail: process.env.NODE_ENV !== "production" ? err?.message : undefined,
    });
  }
}
