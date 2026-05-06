import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

const DEFAULT_USER = {
  clerkId: process.env.SEED_USER_CLERK_ID || "seed_default_pending_user",
  email: process.env.SEED_USER_EMAIL || "test-user@example.com",
  name: process.env.SEED_USER_NAME || "مستخدم تجريبي",
  company: process.env.SEED_USER_COMPANY || "شركة تجريبية",
  phone: process.env.SEED_USER_PHONE || "0500000000",
} as const;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to seed the default pending user.");
  console.error("Set DATABASE_URL, then run: pnpm run seed:default-user");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows: userRows } = await pool.query(
  `insert into users (clerk_id, email, name, role, status, company, phone)
   values ($1, $2, $3, 'company', 'pending', $4, $5)
   on conflict (clerk_id) do update set
     email = excluded.email,
     name = excluded.name,
     role = 'company',
     status = 'pending',
     company = excluded.company,
     phone = excluded.phone
   returning *`,
  [
    DEFAULT_USER.clerkId,
    DEFAULT_USER.email,
    DEFAULT_USER.name,
    DEFAULT_USER.company,
    DEFAULT_USER.phone,
  ],
);

const user = userRows[0];

const { rows: notificationRows } = await pool.query(
  `with existing as (
     select * from notifications where type = 'new_user_pending' and user_id = $1 limit 1
   ), inserted as (
     insert into notifications (type, title, message, user_id)
     select 'new_user_pending', 'طلب تسجيل جديد', 'يوجد مستخدم جديد بانتظار الموافقة', $1
     where not exists (select 1 from existing)
     returning *
   )
   select * from inserted
   union all
   select * from existing`,
  [user.id],
);

console.log(JSON.stringify({ user, notification: notificationRows[0] }, null, 2));
await pool.end();

