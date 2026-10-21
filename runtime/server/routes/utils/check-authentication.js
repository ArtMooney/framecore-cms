import { schema } from "#framecore-cms/config";
import { verifyPassword } from "./password.js";
import { useDrizzle } from "../../db.js";
import { like } from "drizzle-orm";

const { users } = schema;

export async function checkAuthentication(event, email, password) {
  if (!email || !password) return false;

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db.select().from(users).where(like(users.email, email));

  if (!user || user.length === 0) return false;

  return await verifyPassword(password, user[0].password);
}
