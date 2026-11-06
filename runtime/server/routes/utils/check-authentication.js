import { schema } from "#framecore-cms/config";
import { useDrizzle } from "../../db.js";
import { eq } from "drizzle-orm";
import { getCmsSession, passwordVersion } from "./session.js";
import { requireSameOrigin } from "./request.js";

const { users } = schema;

export async function checkAuthentication(event) {
  requireSameOrigin(event);
  const session = await getCmsSession(event);
  const { userId, expiresAt, passwordVersion: version } = session.data;
  if (userId === undefined || !expiresAt || Date.now() >= expiresAt)
    return false;
  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || (await passwordVersion(user.password)) !== version) {
    await session.clear();
    return false;
  }
  return true;
}
