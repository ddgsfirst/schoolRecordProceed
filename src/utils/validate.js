export function isValidTempUrl(v) {
  if (typeof v !== "string") return false;
  return /^https?:\/\/.+/.test(v.trim());
}

export function isValidViewCode(v) {
  if (typeof v !== "string" && typeof v !== "number") return false;
  return /^\d{6}$/.test(String(v).trim());
}