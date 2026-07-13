import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type AuthenticatedRequest = { clerkUserId?: string };

/** Single source of truth for resolving the database user behind a verified Clerk request. */
export async function findCurrentUser(req: AuthenticatedRequest) {
  if (!req.clerkUserId) return undefined;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, req.clerkUserId))
    .limit(1);
  return user;
}
