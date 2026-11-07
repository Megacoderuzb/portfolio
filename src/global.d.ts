import type { routing } from "@/i18n/routing";
import type messages from "@/messages/uz.json";

// Typed locales and message keys for next-intl (t("nav.typo") fails typecheck).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
