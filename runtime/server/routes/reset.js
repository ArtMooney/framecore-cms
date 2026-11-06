import { schema } from "#framecore-cms/config";
import {
  defineEventHandler,
  createError,
  getRequestHeaders,
  readBody,
  useRuntimeConfig,
} from "nuxt/server";
import { checkLogin } from "./utils/check-login.js";
import { sendEmail } from "./utils/send-email.js";
import { messageEmailReset } from "./content/message-email-reset.js";
import { createResetToken } from "./utils/reset-token.js";
import { getCmsRequestURL } from "./utils/request.js";
import { useDrizzle } from "../db.js";
import { eq, sql } from "drizzle-orm";

const { users } = schema;

export default defineEventHandler(async (event) => {
  if (event.req.method !== "POST") {
    throw createError({ statusCode: 405, statusMessage: "Method Not Allowed" });
  }
  const config = useRuntimeConfig();
  const headers = getRequestHeaders(event);
  const body = await readBody(event);

  if (!(await checkLogin(headers, config.userName, config.userPass))) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  if (typeof body?.email !== "string" || !body.email.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing email",
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, body.email.trim().toLowerCase()));

  if (user.length === 0) {
    return "ok"; // User not found, return same as if ok is a security measure
  }

  const resetId = createResetToken();

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

  const pageUrl = new URL("/admin", getCmsRequestURL(event)).href;
  await sendEmail(
    config.emailFrom,
    user[0].email,
    "Change password for your account on Simple CMS",
    await messageEmailReset(pageUrl, resetId),
    config.mailgunApiKey,
  );

  return "ok";
});
