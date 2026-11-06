export const RESET_TOKEN_TTL = 30 * 60 * 1000;

export function createResetToken(now = Date.now()) {
  return `${now}.${crypto.randomUUID()}`;
}

export function isValidResetToken(token, now = Date.now()) {
  if (
    typeof token !== "string" ||
    !/^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      token,
    )
  ) {
    return false;
  }

  const issuedAt = Number(token.slice(0, token.indexOf(".")));
  return issuedAt <= now && now - issuedAt < RESET_TOKEN_TTL;
}
