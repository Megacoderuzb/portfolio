// Runs once when the Next.js server starts: fail fast on bad env.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { serverEnv, publicEnv } = await import("@/lib/env");
    serverEnv();
    publicEnv();
  }
}
