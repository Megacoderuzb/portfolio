import Link from "next/link";
import "./globals.css";

// Non-localized 404 (paths the proxy doesn't handle). Needs its own <html> because the root layout is a pass-through.
export default function NotFound() {
  return (
    <html lang="en">
      <body className="grid min-h-screen place-items-center font-mono text-muted">
        <p>
          <span className="text-violet-400">404</span> · <Link href="/" className="text-violet-300 underline">/</Link>
        </p>
      </body>
    </html>
  );
}
