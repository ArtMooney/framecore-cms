import { cmsTables, schema } from "#framecore-cms/config";
import {
  createError,
  defineEventHandler,
  getRequestHeaders,
  readBody,
  useRuntimeConfig,
} from "nuxt/server";
import { and, eq, getTableColumns, is, or, SQL, sql } from "drizzle-orm";
import { useDrizzle } from "../db.js";
import { checkAuthentication } from "./utils/check-authentication.js";
import { checkLogin } from "./utils/check-login.js";
import { requirePost } from "./utils/session.js";

export default defineEventHandler(async (event) => {
  requirePost(event);
  const config = useRuntimeConfig();
  if (
    !(await checkLogin(
      getRequestHeaders(event),
      config.userName,
      config.userPass,
    )) ||
    !(await checkAuthentication(event))
  ) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody(event);
  const targetConfig = cmsTables.find((table) => table.id === body?.table_id);
  const sourceConfig = cmsTables.find(
    (table) => table.id === targetConfig?.backupRef,
  );
  if (!sourceConfig || !targetConfig || sourceConfig.id === targetConfig.id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid archive table",
    });
  }

  const source = schema[sourceConfig.id];
  const target = schema[targetConfig.id];
  const sourceColumns = getTableColumns(source);
  const targetColumns = getTableColumns(target);
  if (!sourceColumns.date) {
    throw createError({
      statusCode: 400,
      statusMessage: "Archive source requires date ranges",
    });
  }

  const db = useDrizzle(event.context.cloudflare.env.DB);
  const rows = await db
    .select({
      id: sourceColumns.id,
      date: sourceColumns.date,
      rawDate: sql`${sourceColumns.date}`.as("archive_raw_date"),
    })
    .from(source)
    .all();
  const now = Date.now();
  const expired = rows.filter(
    (row) =>
      Array.isArray(row.date) &&
      row.date[1] &&
      new Date(row.date[1]).getTime() < now,
  );
  if (expired.length === 0) return { success: true };

  const selection = Object.fromEntries(
    Object.entries(targetColumns).map(([key, column]) => {
      if (key === "id") return [key, sql`null`];
      if (sourceColumns[key]) return [key, sourceColumns[key]];
      const defaultValue =
        column.default ?? column.defaultFn?.() ?? column.onUpdateFn?.() ?? null;
      return [
        key,
        is(defaultValue, SQL)
          ? defaultValue
          : sql`${sql.param(defaultValue, column)}`,
      ];
    }),
  );
  const defaultParameters = db.select(selection).from(source).toSQL()
    .params.length;
  const chunkSize = Math.floor((100 - defaultParameters) / 2);
  if (chunkSize < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: "Archive schema is too wide",
    });
  }
  const statements = [];
  // Each row contributes an ID and date guard: stay within D1's 100 parameters.
  for (let index = 0; index < expired.length; index += chunkSize) {
    const chunk = expired.slice(index, index + chunkSize);
    const condition = or(
      ...chunk.map((row) =>
        and(
          eq(sourceColumns.id, row.id),
          sql`${sourceColumns.date} = ${row.rawDate}`,
        ),
      ),
    );
    // Select live source rows inside the transaction. A retried/concurrent
    // archive cannot copy rows that another request has already moved.
    statements.push(
      db
        .insert(target)
        .select(db.select(selection).from(source).where(condition)),
      db.delete(source).where(condition),
    );
  }

  try {
    // Keep every chunk in the same transaction, including its deletions.
    await db.batch(statements);
    return { success: true };
  } catch (error) {
    console.error("Failed to archive items:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to archive items; source items were kept",
    });
  }
});
