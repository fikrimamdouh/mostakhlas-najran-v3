import { syncCurrentUser } from "../_lib/syncCurrentUser";

export async function GET(req: Request) {
  return await syncCurrentUser(req);
}
