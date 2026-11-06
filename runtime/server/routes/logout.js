import { defineEventHandler } from "nuxt/server";
import { getCmsSession, requirePost } from "./utils/session.js";

export default defineEventHandler(async (event) => {
  requirePost(event);
  const session = await getCmsSession(event);
  await session.clear();
  return { success: true };
});
