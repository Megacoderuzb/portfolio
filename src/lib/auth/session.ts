import { jwtVerify, SignJWT } from "jose";
import { serverEnv } from "@/lib/env";

// Single-owner admin session: a signed JWT (HS256) in an httpOnly cookie. Imported by src/proxy.ts too.
export const SESSION_COOKIE = "admin_session";
const TTL_SECONDS = 12 * 60 * 60;

function key() {
  const secret = serverEnv().SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export function createSessionToken() {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("owner")
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key());
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, key(), { algorithms: ["HS256"], subject: "owner" });
    return true;
  } catch {
    return false;
  }
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: serverEnv().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TTL_SECONDS,
  };
}
