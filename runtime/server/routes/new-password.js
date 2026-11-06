import { schema } from "#framecore-cms/config";
import {
  defineEventHandler,
  createError,
  getRequestHeaders,
  readBody,
  useRuntimeConfig,
} from "nuxt/server";
import { checkLogin } from "./utils/check-login.js";
import { hashPassword } from "./utils/password.js";
import { isValidResetToken } from "./utils/reset-token.js";
import { sendEmail } from "./utils/send-email.js";
import { messageNewPassword } from "./content/message-new-password.js";
import { useDrizzle } from "../db.js";
import { and, eq } from "drizzle-orm";

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

  if (
    typeof body?.password !== "string" ||
    !body.password ||
    typeof body?.validation !== "string" ||
    !body.validation
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing password or validation",
    });
  }

  if (!isValidResetToken(body.validation)) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid or expired validation code",
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.resetId, body.validation));

  if (!user || user.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Error validating account",
    });
  }

  const hashedPassword = await hashPassword(body.password);

  let updated;
  try {
    updated = await db
      .update(users)
      .set({ password: hashedPassword, resetId: "" })
      .where(and(eq(users.id, user[0].id), eq(users.resetId, body.validation)))
      .returning({ id: users.id });
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: "Error saving password",
    });
  }

  if (updated.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid validation code",
    });
  }

  await sendEmail(
    config.emailFrom,
    user[0].email,
    "Your password to log into Simple CMS was changed",
    await messageNewPassword(),
    config.mailgunApiKey,
  ).catch((error) => {
    console.error("framecore-cms: password change notification failed", error);
  });

  return "ok";
});
