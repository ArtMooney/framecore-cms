import { schema } from "#framecore-cms/config";
import {
  defineEventHandler,
  createError,
  getRequestHeaders,
  readBody,
  useRuntimeConfig,
} from "nuxt/server";
import { checkLogin } from "./utils/check-login.js";
import { isValidResetToken } from "./utils/reset-token.js";
import { useDrizzle } from "../db.js";
import { eq } from "drizzle-orm";

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

  if (typeof body?.validation !== "string" || !body.validation) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing a validation code",
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
      statusMessage: "Invalid validation code",
    });
  }

  return "ok";
});
