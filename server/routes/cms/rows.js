import { checkLogin } from "~~/server/utils/check-login.js";
import { checkAuthentication } from "~~/server/routes/cms/utils/check-authentication.js";
import * as schema from "~~/server/db/schema.ts";
import { cmsTables } from "~~/server/db/cmsConfig.ts";
import { asc, desc } from "drizzle-orm";
import { useDrizzle } from "~~/server/db/client.ts";

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

  if (!(await checkAuthentication(event, body?.email, body?.password))) {
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
