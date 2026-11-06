import { defineEventHandler } from "nuxt/server";
import { checkAuthentication } from "./utils/check-authentication.js";

export default defineEventHandler(async (event) => ({
  authenticated: await checkAuthentication(event),
}));
