import type { Metadata } from "next";
import type { ReactNode } from "react";
import { fontVariables } from "../fonts";
import "../globals.css";

// Owner-only admin: English UI, never indexed (also excluded from the sitemap).
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
