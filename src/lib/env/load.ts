// Side-effect import for scripts outside Next (seed, worker, tests): load .env into process.env.
// Import it first, before anything that reads the env. Missing file is fine (Docker passes real env vars).
try {
  process.loadEnvFile();
} catch {}
