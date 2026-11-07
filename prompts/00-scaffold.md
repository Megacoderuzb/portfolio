# Phase 00 — Scaffold

Paste everything below into Claude Code (run it in the project root that already contains the kit files).

---

Read `CLAUDE.md` and `docs/SPEC.md` (sections 1, 2, 12, 13) first. This is phase 00 of 10: create the project skeleton only. Do not build UI sections yet.

## Tasks

1. **Initialize Next.js** in the current directory (latest stable, App Router, TypeScript strict, Tailwind CSS, ESLint, `src/` directory, import alias `@/*`, pnpm). The directory already contains kit files (`CLAUDE.md`, `README.md`, `docs/`, `prompts/`, `prisma/`, `seed/`, `messages/`, `design/`, `docker-compose*.yml`, `Dockerfile`, `nginx/`, `.env.example`). **Do not overwrite or delete any of them.** If `create-next-app` refuses a non-empty directory, scaffold into a temporary directory and merge the result in.
2. **Install dependencies:** `prisma`, `@prisma/client`, `zod`, `next-intl`, `motion` (Framer Motion's current package; if unavailable use `framer-motion`), `luxon` + `@types/luxon`, `jose`, `bcryptjs` + types, `bullmq`, `ioredis`, `grammy`, `rate-limiter-flexible`, `lucide-react`, and dev: `vitest`, `tsx`, `@vitest/coverage-v8`, `prettier`. Do not add paid/AI SDKs.
3. **Folder structure** exactly as in `CLAUDE.md` (create empty folders with `.gitkeep` where needed): `src/lib/{db,env,auth,time,booking,queue,n8n,events,i18n}`, `src/components/{ui,sections,booking,game,admin}`, `worker/{bot,jobs,lib}`, `n8n/workflows`, `tests`.
4. **Env validation:** `src/lib/env/index.ts` with a zod schema for every variable in `.env.example`; split into `serverEnv` and `publicEnv`; fail fast with a readable error. Worker gets its own `worker/lib/env.ts` (shares the schema where possible).
5. **Prisma:** keep `prisma/schema.prisma` from the kit; **run `prisma validate` first** (the kit's schema was written without a database or Prisma engine available, so it has never been validated) and fix any error; adapt syntax if the installed Prisma version requires it (e.g. Prisma 7 config file). Create `src/lib/db/index.ts` (singleton client, safe for Next dev hot reload). Do **not** run migrations against a real database yet unless `docker-compose.dev.yml` is up; if it is, create the initial migration with `--create-only`, then add the **raw SQL exclusion constraint** described in the schema comments, then apply it.
6. **Scripts** in `package.json`: `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `format`, `seed` (`tsx seed/seed.ts`, file may be a stub for now), `db:migrate`, `db:studio`, `worker` (`tsx worker/index.ts`, stub that logs and exits cleanly for now).
7. **Config:** `next.config` with `output: "standalone"`, `poweredByHeader: false`, and a placeholder for security headers (filled in phase 08). `.gitignore` must include `.env`, `data/`, `.next/`, `node_modules/`. Add `.prettierrc`, `.editorconfig`.
8. **Testing:** Vitest config + one trivial passing test to prove the pipeline.
9. **Health endpoint:** `GET /api/health` returning `{ ok: true }` for now.

## Acceptance criteria

- `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass.
- `pnpm dev` serves a placeholder page; `/api/health` returns JSON.
- All kit files are intact; the folder structure matches `CLAUDE.md`.

## Final report (keep it short)

List what you created, any deviation from the kit (with reason), and anything the owner must do manually.
