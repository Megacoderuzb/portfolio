# Phase 09 — Deploy to the VPS

Prerequisite: phases 00–08 done and committed. The owner has a VPS (Docker + Docker Compose + Nginx installed) and DNS records for the domain and `n8n.<domain>` pointing at it. If you cannot reach the VPS from here, prepare everything and write exact commands for the owner to run.

---

Read `CLAUDE.md`, `docker-compose.yml`, `Dockerfile`, `nginx/portfolio.conf.example`, `.env.example`, `docs/BOOKING-N8N.md` (setup checklist), `docs/QA-CHECKLIST.md` (Operations).

## Tasks

1. **Dockerfile:** build and verify the `app` and `worker` targets locally (`docker compose build`). Fix issues for the installed Next/Prisma versions (standalone output tracing, Prisma engines on Alpine/openssl, `tzdata`). Image sizes reasonable; run as a non-root user where feasible.
2. **Compose (production):** verify `docker compose up -d` brings up db, redis, app, worker, n8n with healthchecks and restart policies; one worker replica only; volumes for `db_data`, `redis_data`, `n8n_data`, `resume_data`. Pin the n8n image to a specific tested version tag (replace `latest`). Ensure app and worker containers can reach `n8n:5678` and n8n can reach the app via `APP_URL`.
3. **Migrations & seed:** documented one-liners: `docker compose run --rm worker pnpm prisma migrate deploy` and `docker compose run --rm worker pnpm seed`.
4. **Nginx + TLS:** finalize `nginx/portfolio.conf` from the example for the real domain (main site + `n8n.` subdomain, websockets for n8n, upload size), Certbot commands, HTTP→HTTPS redirect, gzip/brotli as available, security of the n8n editor (strong owner password; optionally restrict by IP or add basic auth in Nginx for the editor path while leaving `/webhook/*` open).
5. **Backups:** a script `scripts/backup.sh` doing `pg_dump` (compressed, timestamped, keep 14 days) of the db container and archiving the `resume_data` and `n8n_data` volumes; a cron example; a documented **restore** procedure that you actually test locally once.
6. **Updates:** `scripts/deploy.sh` (pull, build, migrate, restart with minimal downtime) and a rollback note. Optional: GitHub Actions deploy workflow over SSH (document required secrets; do not store secrets in the repo).
7. **Runbook:** write `docs/RUNBOOK.md`: architecture diagram (text), start/stop/logs commands per service, how to rotate secrets, how to re-authorize Google in n8n, how to add a project/service, how to replace the resume, how to move to a new server, common failures and fixes (Telegram bot not responding → check single worker; reminders missing → Redis and re-enqueue; bookings stuck in `PENDING_MEET` → n8n credentials/health and admin Retry).
8. **Smoke test on the server:** `/api/health` green; book a test slot (Calendar event + Meet + Sheets row + Telegram message); bot reminder round trip; resume download; game loads lazily; certificates valid; Lighthouse on the production URL.

## Rules

No secrets in the repo or images · `.env` only on the server · n8n and Postgres/Redis ports bound to loopback only (never public) · HSTS only after HTTPS is confirmed working.

## Acceptance criteria

- `docs/QA-CHECKLIST.md` *Operations* section passes and the whole checklist is ticked in the final report.
- A clean server can be rebuilt from the repo + `.env` + the latest backup using only the runbook.

## Final report

Exact commands the owner runs, what you verified vs. could not verify without server access, and remaining manual steps.
