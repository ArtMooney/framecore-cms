import { checkLogin } from "~~/server/utils/check-login.js";
import { useDrizzle } from "~~/server/db/client.ts";
import { users } from "~~/server/db/schema.ts";
import { like } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const headers = getHeaders(event);
  const body = await readBody(event);

  if (!(await checkLogin(headers, config.userName, config.userPass))) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  if (!body?.validation) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing a validation code",
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(like(users.resetId, body.validation));

  if (!user || user.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid validation code",
    });
  }

  return "ok";
});
