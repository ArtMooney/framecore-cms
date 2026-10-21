import { cmsTables, schema } from "#framecore-cms/config";
import { defineEventHandler, createError, getHeaders, readBody } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
import { checkLogin } from "./utils/check-login.js";
import { checkAuthentication } from "./utils/check-authentication.js";
import { useDrizzle } from "../db.js";
import { inArray } from "drizzle-orm";

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

  if (!cmsTables.some((table) => table.id === tableName)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid table",
    });
  }

  if (items.length === 0) return { success: true };

  const ids = items.map((item) => item.id).filter((id) => id !== undefined);

  if (ids.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No valid IDs provided",
    });
  }

  const chunkSize = 100;
  const chunks = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }

  try {
    for (const chunk of chunks) {
      await db
        .delete(schema[tableName])
        .where(inArray(schema[tableName].id, chunk));
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to delete items:", error);
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to delete items",
    });
  }
});
