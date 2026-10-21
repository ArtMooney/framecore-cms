import { cmsTables, schema } from "#framecore-cms/config";
import { defineEventHandler, createError, getHeaders, readBody } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
import { checkLogin } from "./utils/check-login.js";
import { checkAuthentication } from "./utils/check-authentication.js";
import { uploadFile } from "./r2/upload-file.js";
import { deleteIfExists } from "./r2/delete-if-exists.js";
import {
  handleJsonFileUploads,
  handleJsonDeletePrevious,
} from "./utils/json-file-handler.js";
import { useDrizzle } from "../db.js";
import { eq } from "drizzle-orm";

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
  const bucket = event.context.cloudflare?.env.FILES;

  if (!bucket) {
    throw createError({
      statusCode: 500,
      message: "R2-binding is missing",
    });
  }

  if (!cmsTables.some((t) => t.id === tableName)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid table",
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
        if (currentStoredItem[field?.name] !== body.item[field.name]) {
          await deleteIfExists(
            bucket,
            `cms-files/${currentStoredItem[field.name]}`,
          );
        }
      }
    }

    if (body.item[field.name]) {
      if (field?.type === "file" || field?.type === "fileImg") {
        if (body?.item[field?.name][0]?.file?.length > 0) {
          body.item[field.name] = await uploadFile(
            bucket,
            body.item[field.name][0].name,
            body.item[field.name][0].file,
            body.item[field.name][0].contentType,
          );
        }
      }
    }
  }

  await handleJsonDeletePrevious(
    bucket,
    currentStoredItem,
    body.item,
    body.schema,
  );

  await handleJsonFileUploads(bucket, body.item, body.schema);

  try {
    const updatedItem = await db
      .update(schema[tableName])
      .set(body.item)
      .where(eq(schema[tableName].id, body.item.id))
      .returning();

    return updatedItem[0];
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: "Failed to update item",
    });
  }
});
