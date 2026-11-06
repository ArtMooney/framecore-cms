import { $fetch } from "ofetch";
import { useRuntimeConfig } from "#imports";

export function cmsRequest(url, options = {}) {
  const config = useRuntimeConfig();
  return $fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      Authorization:
        "Basic " + btoa(config.public.userName + ":" + config.public.userPass),
      ...options.headers,
    },
  });
}

export function apiErrorMessage(
  error,
  fallback = "Something went wrong. Please try again.",
) {
  if ((error.statusCode ?? error.status) >= 500) return fallback;
  return (
    error.data?.statusMessage ||
    error.data?.message ||
    error.statusMessage ||
    fallback
  );
}
