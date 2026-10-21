import { schema } from "#framecore-cms/config";
import { defineEventHandler, createError, getHeaders, readBody } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
import { checkLogin } from "./utils/check-login.js";
import { useDrizzle } from "../db.js";
import { like } from "drizzle-orm";

const { users } = schema;

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
