import { cmsTables, schema } from "#framecore-cms/config";
import {
  defineEventHandler,
  createError,
  getRequestHeaders,
  readBody,
  useRuntimeConfig,
} from "nuxt/server";
import { checkLogin } from "./utils/check-login.js";
import { checkAuthentication } from "./utils/check-authentication.js";
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

  const itemsWithoutId = items.map(({ id, ...rest }) => rest);
  const chunkSize = 5;
  const chunks = [];

  for (let i = 0; i < itemsWithoutId.length; i += chunkSize) {
    chunks.push(itemsWithoutId.slice(i, i + chunkSize));
  }

  try {
    for (const chunk of chunks) {
      await db.insert(schema[tableName]).values(chunk);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to insert items:", error);
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to insert items",
    });
  }
});
