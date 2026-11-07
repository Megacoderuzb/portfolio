import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { allow, limiter } from "@/lib/rate-limit";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** Server Components / Server Actions: continue only for the logged-in owner (the proxy checks too). */
export async function requireAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) redirect("/admin/login");
}

const credentialsSchema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(200),
});

const sha256 = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time email check + bcrypt (always run, so timing doesn't reveal which part failed). */
export async function checkCredentials(
  email: string,
  password: string,
  owner: { email?: string; passwordHash?: string },
) {
  if (!owner.email || !owner.passwordHash) return false;
  const emailOk = timingSafeEqual(sha256(email.trim().toLowerCase()), sha256(owner.email.trim().toLowerCase()));
  const passwordOk = await bcrypt.compare(password, owner.passwordHash);
  return emailOk && passwordOk;
}

/** 5 attempts / 15 min per IP (successful logins reset it). */
export const loginLimiter = () => limiter("login", 5, 15 * 60);

export async function attemptLogin(input: unknown, ipHash: string): Promise<"ok" | "invalid" | "limited"> {
  if (!(await allow(loginLimiter(), ipHash))) return "limited";
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return "invalid";
  const env = serverEnv();
  const ok = await checkCredentials(parsed.data.email, parsed.data.password, {
    email: env.ADMIN_EMAIL,
    passwordHash: env.ADMIN_PASSWORD_HASH,
  });
  if (ok) await loginLimiter().delete(ipHash);
  return ok ? "ok" : "invalid";
}
