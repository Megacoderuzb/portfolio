import { Inter, JetBrains_Mono, Manrope } from "next/font/google";

// Shared by the public ([locale]) and admin root layouts. next/font needs literal options (no shared variables).
// `subsets` only chooses what is *preloaded*: every subset (cyrillic, latin-ext…) is still declared and
// downloaded on demand by unicode-range. Preloading all of them cost ~270 KB on every page and hurt LCP.
const manrope = Manrope({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-manrope", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], preload: false, variable: "--font-jetbrains", display: "swap" });

/** Put on <html>: exposes the font CSS variables used by the Tailwind theme. */
export const fontVariables = `${manrope.variable} ${inter.variable} ${mono.variable}`;
