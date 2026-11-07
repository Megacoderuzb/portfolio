"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/admin/action-form";
import { attemptLogin } from "@/lib/auth";
import { createSessionToken, sessionCookie } from "@/lib/auth/session";
import { clientIp, hashIp } from "@/lib/ip";

export async function login(_: ActionState, data: FormData): Promise<ActionState> {
  const ipHash = hashIp(clientIp(await headers()));
  const result = await attemptLogin({ email: data.get("email"), password: data.get("password") }, ipHash);
  if (result === "limited") return { error: "Too many attempts. Try again in 15 minutes." };
  if (result === "invalid") return { error: "Wrong email or password." };
  (await cookies()).set(sessionCookie(await createSessionToken()));
  redirect("/admin");
}
