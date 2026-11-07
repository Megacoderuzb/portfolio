// Throwaway admin credentials for the e2e server (playwright.config.ts hashes the password into ADMIN_PASSWORD_HASH).
// Not secrets: the e2e app instance only exists while the tests run.
export const E2E_ADMIN = { email: "e2e-admin@example.test", password: "e2e-password-not-a-secret" };
