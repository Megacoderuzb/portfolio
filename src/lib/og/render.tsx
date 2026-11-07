import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getOwner } from "@/lib/content";

// Social card (1200×630): violet on black, "MA" monogram, name, role, "Free consultation". No photo.
// Colors are the design tokens (an image can't read CSS variables). Inter 700 as .woff: satori can't use woff2.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const TOKENS = {
  bg: "#07070b",
  surface: "#111018",
  v300: "#c4b5fd",
  v400: "#a78bfa",
  v500: "#8b5cf6",
  v600: "#7c3aed",
  text: "#f4f2fa",
  muted: "#a29db5",
};

// readFile, not fetch: Node's fetch can't open file: URLs. Turbopack emits the .woff files next to the server
// bundle (and into .next/standalone), and `new URL(…, import.meta.url)` points at them.
const font = (file: URL) => readFile(file);

export async function renderOg(locale: Locale) {
  const [t, h, latin, cyrillic] = await Promise.all([
    getTranslations({ locale, namespace: "meta" }),
    getTranslations({ locale, namespace: "hero" }),
    font(new URL("./inter-latin-700.woff", import.meta.url)),
    font(new URL("./inter-cyrillic-700.woff", import.meta.url)),
  ]);
  const { fullName } = getOwner();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: `radial-gradient(circle at 85% 15%, ${TOKENS.v600}66 0%, ${TOKENS.bg} 55%)`,
        color: TOKENS.text,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${TOKENS.v500}, ${TOKENS.v600})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 44,
          letterSpacing: -1,
        }}
      >
        MA
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 84, lineHeight: 1.05, letterSpacing: -2 }}>{fullName}</div>
        <div style={{ marginTop: 20, fontSize: 44, color: TOKENS.v300 }}>{h("role")}</div>
        <div style={{ marginTop: 12, fontSize: 28, color: TOKENS.muted }}>NestJS · Next.js · TypeScript</div>
      </div>

      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            padding: "16px 32px",
            borderRadius: 999,
            border: `2px solid ${TOKENS.v400}`,
            background: TOKENS.surface,
            color: TOKENS.v300,
            fontSize: 32,
          }}
        >
          {t("ogCta")}
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Inter", data: latin, weight: 700, style: "normal" },
        { name: "Inter", data: cyrillic, weight: 700, style: "normal" },
      ],
    },
  );
}
