import { syncCurrentUser } from "../_lib/syncCurrentUser";

export async function POST(req: Request) {
  return await syncCurrentUser(req);
}
