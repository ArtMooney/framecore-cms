import { checkLogin } from "~~/server/utils/check-login.js";
import { checkAuthentication } from "~~/server/routes/cms/utils/check-authentication.js";
import { uploadFile } from "~~/server/routes/cms/r2/upload-file.js";
import { handleJsonFileUploads } from "~~/server/routes/cms/utils/json-file-handler.js";
import { useDrizzle } from "~~/server/db/client.ts";
import * as schema from "~~/server/db/schema.ts";
import { cmsTables } from "~~/server/db/cmsConfig.ts";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const headers = getHeaders(event);
  const body = await readBody(event);
  const db = useDrizzle(event.context.cloudflare.env.DB);

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

  const bucket = event.context.cloudflare?.env.FILES;
  if (!bucket) {
    throw createError({
      statusCode: 500,
      message: "R2-binding is missing",
    });
  }

  for (const field of body.schema) {
    if (body.item[field.name]) {
      if (
        (field?.type === "file" || field?.type === "fileImg") &&
        body?.item[field?.name][0]?.file?.length > 0
      ) {
        body.item[field.name] = await uploadFile(
          bucket,
          body.item[field.name][0].name,
          body.item[field.name][0].file,
          body.item[field.name][0].contentType,
        );
      }
    }
  }

  await handleJsonFileUploads(bucket, body.item, body.schema);

  const tableName = body?.table_id;

  if (!cmsTables.some((t) => t.id === tableName)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid table",
    });
  }

  try {
    const insertedItem = await db
      .insert(schema[tableName])
      .values(body.item)
      .returning();

    return insertedItem[0];
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to save item",
    });
  }
});
