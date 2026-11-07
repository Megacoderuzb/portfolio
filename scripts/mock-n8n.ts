import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

export type Received = { path: string; headers: IncomingHttpHeaders; body: unknown };

/**
 * Tiny stand-in for n8n's webhook endpoint: answers request N with statuses[N] (the last status repeats)
 * and records what it received. Used by tests/dispatch.test.ts and `pnpm test:dispatch --mock`.
 */
export async function startMockN8n(statuses: number[]) {
  const received: Received[] = [];
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      received.push({ path: req.url ?? "", headers: req.headers, body: raw ? JSON.parse(raw) : null });
      res.statusCode = statuses[Math.min(received.length - 1, statuses.length - 1)];
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
