import { schema } from "#framecore-cms/config";
import {
  defineEventHandler,
  createError,
  getRequestHeaders,
  readBody,
  useRuntimeConfig,
} from "nuxt/server";
import { checkLogin } from "./utils/check-login.js";
import { verifyPassword } from "./utils/password.js";
import { useDrizzle } from "../db.js";
import { like } from "drizzle-orm";

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

  if (!body?.email || !body?.password) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing email or password",
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(like(users.email, body.email));

  const passwordValid =
    user.length > 0 && (await verifyPassword(body.password, user[0].password));

  if (!passwordValid) {
    throw createError({
      statusCode: 401,
      statusMessage: "Error logging in",
    });
  }

  return {
    success: true,
    data: {
      message: "Logged in successfully",
    },
  };
});
