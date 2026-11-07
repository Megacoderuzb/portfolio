// Owner alerts via the plain Telegram Bot API (sendMessage only). The token is never logged: errors print no URL.

export async function notifyOwner(text: string, env: { TELEGRAM_BOT_TOKEN?: string; OWNER_TELEGRAM_ID?: number }) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.OWNER_TELEGRAM_ID) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN / OWNER_TELEGRAM_ID not set: owner alert not sent");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.OWNER_TELEGRAM_ID, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[telegram] sendMessage responded ${res.status}`);
    return res.ok;
  } catch {
    console.error("[telegram] sendMessage failed (network)");
    return false;
  }
}
