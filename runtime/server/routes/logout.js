import { defineEventHandler } from "nuxt/server";
import { getCmsSession } from "./utils/session.js";
import { requirePost } from "./utils/request.js";

export default defineEventHandler(async (event) => {
  requirePost(event);
  const session = await getCmsSession(event);
  await session.clear();
  return { success: true };
});
