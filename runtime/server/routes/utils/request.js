import { createError, getRequestHeader, getRequestURL } from "nuxt/server";

export function getCmsRequestURL(event) {
  // Cloudflare retains the external URL even when Nitro's Node adapter
  // reconstructs the request as HTTP. Do not trust client-forwarded headers.
  const platformRequest = event.context.cloudflare?.request;
  return platformRequest ? new URL(platformRequest.url) : getRequestURL(event);
}

export function requireSameOrigin(event) {
  const origin = getRequestHeader(event, "origin");
  if (
    getRequestHeader(event, "sec-fetch-site") === "cross-site" ||
    (origin && origin !== getCmsRequestURL(event).origin)
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "Invalid request origin",
    });
  }
}

export function requirePost(event) {
  if (event.req.method !== "POST") {
    throw createError({ statusCode: 405, statusMessage: "Method not allowed" });
  }
  requireSameOrigin(event);
}
