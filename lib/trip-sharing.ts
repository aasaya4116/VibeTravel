const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function isValidShareToken(value: string) {
  return SHARE_TOKEN_PATTERN.test(value)
}

export function buildShareUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/share/${token}`
}
