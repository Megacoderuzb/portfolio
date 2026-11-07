// Logs never carry personal data: Prisma error messages can echo query values, so only names/codes are printed.

/** Error → short label safe for logs (name, Prisma code, Telegram's own description). */
export function errorLabel(e: unknown) {
  if (!(e instanceof Error)) return "unknown error";
  const { code, description } = e as { code?: unknown; description?: unknown };
  return [e.name, typeof code === "string" ? code : "", typeof description === "string" ? description : ""]
    .filter(Boolean)
    .join(" ");
}
