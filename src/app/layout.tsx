import type { ReactNode } from "react";

// Pass-through: <html> is rendered by src/app/[locale]/layout.tsx (and later by src/app/admin/layout.tsx),
// so each tree sets its own `lang`.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
