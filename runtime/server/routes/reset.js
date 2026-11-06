import { schema } from "#framecore-cms/config";
import {
  defineEventHandler,
  createError,
  getRequestHeaders,
  readBody,
  useRuntimeConfig,
} from "nuxt/server";
import { checkLogin } from "./utils/check-login.js";
import { randomUUID } from "crypto";
import { sendEmail } from "./utils/send-email.js";
import { messageEmailReset } from "./content/message-email-reset.js";
import { useDrizzle } from "../db.js";
import { eq, like } from "drizzle-orm";

const { users } = schema;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const headers = getRequestHeaders(event);
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
