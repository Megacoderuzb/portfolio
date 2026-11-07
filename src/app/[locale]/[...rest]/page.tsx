import { notFound } from "next/navigation";

// Any unknown path under a valid locale: renders the localized not-found page (with a real 404 status).
export default function CatchAll() {
  notFound();
}
