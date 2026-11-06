import {
  createError,
  deleteCookie,
  getCookie,
  useRuntimeConfig,
  useSession,
} from "nuxt/server";
import { getCmsRequestURL } from "./request.js";

const SESSION_NAME = "framecore-cms-session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export async function passwordVersion(passwordHash) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(passwordHash),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function getCmsSession(event) {
  event.res.headers.set("Cache-Control", "no-store");
  // Nitro 2 freezes no-argument runtime config before Worker bindings exist.
  // Read this deployment secret from the request's bindings when available.
  const password =
    event.context.cloudflare?.env?.NUXT_CMS_SESSION_PASSWORD ??
    useRuntimeConfig().cmsSessionPassword;
  if (typeof password !== "string" || password.length < 32) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Set NUXT_CMS_SESSION_PASSWORD to a random secret of at least 32 characters",
    });
  }

  // Remove the old persisted store, which contained the administrator password.
  if (getCookie(event, "framecore-cms:login") !== undefined) {
    deleteCookie(event, "framecore-cms:login", { path: "/" });
  }
  const url = getCmsRequestURL(event);
  const localHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return useSession(event, {
    name: SESSION_NAME,
    password,
    maxAge: SESSION_MAX_AGE,
    cookie: {
      httpOnly: true,
      secure: !localHttp,
      sameSite: "strict",
      path: "/cms",
    },
  });
}

export async function startCmsSession(event, user) {
  const session = await getCmsSession(event);
  await session.clear();
  await session.update({
    userId: user.id,
    passwordVersion: await passwordVersion(user.password),
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
  });
}
