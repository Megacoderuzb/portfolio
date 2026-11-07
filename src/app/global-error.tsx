"use client";

import "./globals.css";

// Last resort: the root layout itself failed, so there is no locale, no messages and no providers.
// The one place with fixed text, so it says the same thing in all three site languages.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body className="grid min-h-screen place-items-center px-6 text-center">
        <main role="alert">
          <h1 className="font-heading text-2xl font-bold">
            Nimadir xato ketdi · Что-то пошло не так · Something went wrong
          </h1>
          <button
            type="button"
            onClick={reset}
            className="mt-8 min-h-11 rounded-full bg-violet-600 px-6 py-2 font-medium text-text hover:bg-violet-700"
          >
            Qayta urinish · Попробовать снова · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
