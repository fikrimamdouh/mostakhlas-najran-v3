import { createClerkClient, verifyToken } from "@clerk/backend";

export const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function requireAuth(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    req.auth = { userId: payload.sub };
    req.clerkUserId = payload.sub;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
