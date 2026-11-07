import "@/lib/env/load";
import { createdPayload, postToN8n } from "../worker/lib/n8n";
import { startMockN8n } from "./mock-n8n";

// pnpm test:dispatch          → POST a sample booking to the real n8n webhook ({N8N_BASE_URL}/webhook/booking-created).
//                               n8n creates a REAL Calendar event + Sheets row + Telegram message for it — delete
//                               them afterwards. The app callback answers 404 (the sample booking isn't in the DB).
// pnpm test:dispatch --mock   → same request against a local mock; prints exactly what n8n would receive.

async function main() {
  const mock = process.argv.includes("--mock") ? await startMockN8n([200]) : null;
  const baseUrl = mock?.url ?? process.env.N8N_BASE_URL ?? "http://localhost:5678";
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  startsAt.setUTCMinutes(0, 0, 0);

  const body = createdPayload(
    {
      id: "test-dispatch",
      token: "test-dispatch-token-000000000000000000000000",
      name: "Test Visitor",
      email: "visitor@example.com",
      telegram: "@test",
      phone: null,
      company: "Test Co",
      note: "Sent by scripts/test-dispatch.ts",
      purpose: "JOB_OFFER",
      locale: "uz",
      visitorTimezone: "Europe/London",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000),
      calendarEventId: null,
      service: { slug: "crm-pms", content: { en: { title: "CRM / PMS / admin systems" } } },
    },
    appUrl,
  );

  const status = await postToN8n({ baseUrl, secret: process.env.N8N_WEBHOOK_SECRET, path: "booking-created", body });
  console.log(`[test-dispatch] ${baseUrl}/webhook/booking-created → ${status}`);
  if (mock) {
    const [req] = mock.received;
    console.log(JSON.stringify({ path: req.path, secretHeader: req.headers["x-webhook-secret"] ? "(set)" : "(missing)", body: req.body }, null, 2));
    await mock.close();
  }
}

main().catch((e) => {
  console.error("[test-dispatch] failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
