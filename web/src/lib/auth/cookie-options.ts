export function cookieSecure(appOrigin: string | undefined): boolean {
  if (!appOrigin) return true;
  try {
    return new URL(appOrigin).protocol === "https:";
  } catch {
    return true;
  }
}
