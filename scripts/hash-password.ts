import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";

// Usage: pnpm hash-password  → prompts for the password, prints the .env line.
// The password is read from the prompt (not argv) so it doesn't end up in shell history.
async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const password = await rl.question("Admin password (min 12 chars): ");
  rl.close();
  if (password.length < 12) {
    console.error("Too short: use at least 12 characters.");
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  console.log("\n# base64 of the bcrypt hash: no '$' characters, so .env and docker compose don't mangle it");
  console.log(`ADMIN_PASSWORD_HASH=${Buffer.from(hash).toString("base64")}`);
}

main();
