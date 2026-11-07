import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uz", "ru", "en"],
  defaultLocale: "uz",
  // remember an explicit language choice for a year (default would be a session cookie)
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});
