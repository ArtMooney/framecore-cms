import { schema, cmsTables, fieldsConfig } from "#framecore-cms/config";
import { defineEventHandler, createError, getHeaders, readBody } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
import { checkLogin } from "./utils/check-login.js";
import { checkAuthentication } from "./utils/check-authentication.js";
import { getTableColumns } from "drizzle-orm";

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

  const table = schema[tableName];
  const columns = getTableColumns(table);
  const fields = fieldsConfig[tableName];

  return Object.keys(columns).map((key) => ({
    name: key,
    type: fields[key].type,
    select_options: fields[key].select_options,
    label: fields[key].label,
    required: fields[key].required,
    hidden: fields[key].hidden,
  }));
});
