import { schema, cmsTables } from "#framecore-cms/config";
import {
  defineEventHandler,
  createError,
  getRequestHeaders,
  readBody,
  useRuntimeConfig,
} from "nuxt/server";
import { checkLogin } from "./utils/check-login.js";
import { checkAuthentication } from "./utils/check-authentication.js";
import { asc, desc } from "drizzle-orm";
import { useDrizzle } from "../db.js";

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

  if (!(await checkAuthentication(event))) {
    throw createError({
      statusCode: 401,
      statusMessage: "Failed to login",
    });
  }

  const tableName = body?.table_id;

  if (!cmsTables.some((t) => t.id === tableName)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid table",
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const sortField = body?.field_name ?? "sortOrder";
  const sortOrder = body?.sort_order ?? "asc";
  const column = schema[tableName][sortField];
  const order = sortOrder === "asc" ? asc(column) : desc(column);

  return db.select().from(schema[tableName]).orderBy(order).all();
});
