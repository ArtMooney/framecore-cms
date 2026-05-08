import { checkLogin } from "~~/server/utils/check-login.js";
import { checkAuthentication } from "~~/server/routes/cms/utils/check-authentication.js";
import { useDrizzle } from "~~/server/db/client.ts";
import * as schema from "~~/server/db/schema.ts";
import { cmsTables } from "~~/server/db/cmsConfig.ts";
import { eq } from "drizzle-orm";
import { deleteIfExists } from "~~/server/routes/cms/r2/delete-if-exists.js";
import { handleJsonFileDeleteAll } from "~~/server/routes/cms/utils/json-file-handler.js";

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
  const tableName = body?.table_id;

  if (!cmsTables.some((t) => t.id === tableName)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid table",
    });
  }

  const bucket = event.context.cloudflare?.env.FILES;
  if (!bucket) {
    throw createError({
      statusCode: 500,
      message: "R2-binding is missing",
    });
  }

  const currentStoredItem = await db
    .select()
    .from(schema[tableName])
    .where(eq(schema[tableName].id, body.item.id))
    .get();

  for (const field of body.schema) {
    if (currentStoredItem[field.name]) {
      if (field?.type === "file" || field?.type === "fileImg") {
        if (currentStoredItem[field?.name]) {
          await deleteIfExists(
            bucket,
            `cms-files/${currentStoredItem[field.name]}`,
          );
        }
      }
    }
  }

  await handleJsonFileDeleteAll(bucket, currentStoredItem, body.schema);

  try {
    await db
      .delete(schema[tableName])
      .where(eq(schema[tableName].id, body.item.id));

    return { success: true };
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to delete item",
    });
  }
});
