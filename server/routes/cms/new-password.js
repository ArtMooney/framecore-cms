import { checkLogin } from "~~/server/utils/check-login.js";
import { hashPassword } from "~~/server/routes/cms/utils/password.js";
import { sendEmail } from "~~/server/utils/mailgun/send-email.js";
import { messageNewPassword } from "~~/server/routes/cms/content/message-new-password.js";
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

  if (!body.password || !body.validation) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing password or validation",
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
      statusMessage: "Error validating account",
    });
  }

  const hashedPassword = await hashPassword(body.password);

  try {
    await db
      .update(users)
      .set({ password: hashedPassword, resetId: "" })
      .where(eq(users.id, user[0].id));
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Error saving password",
    });
  }

  const sendToEmail = await sendEmail(
    config.emailFrom,
    user[0].email,
    "Your password to log into Simple CMS was changed",
    await messageNewPassword(),
    config.mailgunApiKey,
  );

  return "ok";
});
