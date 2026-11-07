import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteUrl } from "@/lib/seo";

// Request time (connection): APP_URL isn't available when the Docker image is built.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/*/booking/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
