// Structured JSON logger: one line per event on stdout (info) or stderr (warn/error), easy to grep and ship.
// No personal data: fields whose key looks personal or secret are replaced, and errors are logged by class only
// (Prisma/fetch messages can echo query values or URLs).

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SENSITIVE = /^(email|name|phone|telegram|company|note|ip|cookie|authorization)$|token|secret|password|hash/i;

function redact(fields: Fields): Fields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, SENSITIVE.test(key) ? "[redacted]" : value]),
  );
}

/** Error → short label safe for logs: class name, Prisma/Node code. Never the message. */
export function errorLabel(e: unknown) {
  if (!(e instanceof Error)) return "unknown error";
  const code = (e as { code?: unknown }).code;
  return [e.name, typeof code === "string" ? code : ""].filter(Boolean).join(" ");
}

function write(level: Level, msg: string, fields: Fields = {}) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...redact(fields) });
  (level === "info" ? console.log : level === "warn" ? console.warn : console.error)(line);
}

export const log = {
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};
