import { checkLogin } from "~~/server/utils/check-login.js";
import { checkAuthentication } from "~~/server/routes/cms/utils/check-authentication.js";
import { cmsTables } from "~~/server/db/cmsConfig.ts";
import { useDrizzle } from "~~/server/db/client.ts";
import * as schema from "~~/server/db/schema.ts";
import { inArray, sql } from "drizzle-orm";

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

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const tableName = body.table_id;
  const items = body.items;

  if (!cmsTables.some((t) => t.id === tableName)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid table",
    });
  }

  if (items.length === 0) return { success: true };

  let itemsCleaned = [];

  for (const item of items) {
    if (!item.id || item.sortOrder === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing parameter in item list",
      });
    }

    itemsCleaned.push({
      id: item.id,
      sortOrder: item.sortOrder,
    });
  }

  const chunkSize = 30;
  const chunks = [];

  for (let i = 0; i < itemsCleaned.length; i += chunkSize) {
    chunks.push(itemsCleaned.slice(i, i + chunkSize));
  }

  const updates = chunks.map((chunk) => {
    const sqlChunks = [];
    const ids = [];
    sqlChunks.push(sql`(case`);
    for (const item of chunk) {
      sqlChunks.push(
        sql`when ${schema[tableName].id} = ${item.id} then ${item.sortOrder}`,
      );
      ids.push(item.id);
    }
    sqlChunks.push(sql`end)`);
    const finalSql = sql.join(sqlChunks, sql.raw(" "));
    return db
      .update(schema[tableName])
      .set({ sortOrder: finalSql })
      .where(inArray(schema[tableName].id, ids));
  });

  try {
    await db.batch(updates);

    return { success: true };
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to update items",
    });
  }
});
