import { schema } from "#framecore-cms/config";
import { defineEventHandler, createError, getHeaders } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
import { checkLogin } from "./utils/check-login.js";
import { useDrizzle } from "../db.js";

const { static_content } = schema;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const headers = getHeaders(event);

  if (!(await checkLogin(headers, config.userName, config.userPass))) {
    throw createError({
      statusCode: 401,
      statusMessage: "Login failed",
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  return db.select().from(static_content).all();
});
