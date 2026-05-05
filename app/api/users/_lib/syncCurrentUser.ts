import { auth, clerkClient } from "@clerk/nextjs/server";
import { Pool } from "pg";

type UserRow = {
  id: number;
  clerk_id: string;
  email: string;
  name: string;
  role: "admin" | "company" | "user" | "supervisor";
  status: "pending" | "approved" | "rejected";
  company: string | null;
  phone: string | null;
  last_login_at: string | null;
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PRIMARY_ADMIN_EMAIL = (process.env.PRIMARY_ADMIN_EMAIL || "rorofikri@gmail.com").trim().toLowerCase();
const PRIMARY_ADMIN_CLERK_ID = (process.env.PRIMARY_ADMIN_CLERK_ID || "user_3DIFbR0YQyLX8xxPdBCeLl2CcTX").trim();

async function updateSeenColumns(clerkId: string) {
  await pool.query("update users set last_login_at = now() where clerk_id = $1", [clerkId]);
  try {
    await pool.query("update users set last_seen_at = now() where clerk_id = $1", [clerkId]);
  } catch {
    // Column may not exist in older DBs.
  }
}

export async function syncCurrentUser(req?: Request): Promise<Response> {
  console.log("SYNC ROUTE HIT");
  const { userId, sessionClaims } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let email = String((sessionClaims as any)?.email || "").trim().toLowerCase();
  if (!email) {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    email = String(clerkUser.emailAddresses?.[0]?.emailAddress || "").trim().toLowerCase();
  }

  const body = req ? await req.json().catch(() => ({} as any)) : {};
  const inputName = String(body?.name || "").trim();
  const inputCompany = body?.company ? String(body.company) : null;
  const inputPhone = body?.phone ? String(body.phone) : null;

  const isPrimaryAdmin = email === PRIMARY_ADMIN_EMAIL || (PRIMARY_ADMIN_CLERK_ID && userId === PRIMARY_ADMIN_CLERK_ID);
  const targetRole: UserRow["role"] = isPrimaryAdmin ? "admin" : "company";
  const targetStatus: UserRow["status"] = isPrimaryAdmin ? "approved" : "pending";

  const existing = await pool.query<UserRow>("select * from users where clerk_id = $1 limit 1", [userId]);

  if (existing.rowCount === 0) {
    const inserted = await pool.query<UserRow>(
      `insert into users (clerk_id, email, name, role, status, company, phone, created_at, last_login_at)
       values ($1,$2,$3,$4,$5,$6,$7, now(), now())
       returning *`,
      [userId, email || "", inputName || "مستخدم جديد", targetRole, targetStatus, inputCompany, inputPhone],
    );
    console.log("SYNC USER CREATED", inserted.rows[0]);
    return Response.json(inserted.rows[0], { status: 200 });
  }

  const user = existing.rows[0];
  const updates: Partial<UserRow> = {};
  if (email && email !== String(user.email || "").trim().toLowerCase()) updates.email = email;
  if (inputName && inputName !== user.name) updates.name = inputName;
  if (inputCompany !== null && inputCompany !== user.company) updates.company = inputCompany;
  if (inputPhone !== null && inputPhone !== user.phone) updates.phone = inputPhone;
  if (user.role !== targetRole) updates.role = targetRole;
  if (user.status !== targetStatus) updates.status = targetStatus;

  if (Object.keys(updates).length > 0) {
    const fields = Object.keys(updates);
    const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
    const values = [userId, ...fields.map((f) => (updates as any)[f])];
    const updated = await pool.query<UserRow>(`update users set ${setClause} where clerk_id = $1 returning *`, values);
    await updateSeenColumns(userId);
    console.log("SYNC USER UPDATED", updated.rows[0]);
    return Response.json(updated.rows[0], { status: 200 });
  }

  await updateSeenColumns(userId);
  console.log("SYNC USER UPDATED", user);
  return Response.json(user, { status: 200 });
}
