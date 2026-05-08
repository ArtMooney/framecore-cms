import { checkLogin } from "~~/server/utils/check-login.js";
import { randomUUID } from "crypto";
import { sendEmail } from "~~/server/utils/mailgun/send-email.js";
import { messageEmailReset } from "~~/server/routes/cms/content/message-email-reset.js";
import { useDrizzle } from "~~/server/db/client.ts";
import { users } from "~~/server/db/schema.ts";
import { eq, like } from "drizzle-orm";

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

  if (!body?.email || !body?.pageuri) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing email or pageuri",
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(like(users.email, body.email));

  if (!user) {
    return "ok"; // User not found, return same as if ok is a security measure
  }

  const resetId = randomUUID();

  try {
    await db
      .update(users)
      .set({ resetId: resetId })
      .where(eq(users.id, user[0].id));
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Error saving user",
    });
  }

  const sendToEmail = await sendEmail(
    config.emailFrom,
    body.email,
    "Change password for your account on Simple CMS",
    await messageEmailReset(body.pageuri, resetId),
    config.mailgunApiKey,
  );

  return "ok";
});
