import type { MetadataRoute } from "next";
import { getSiteBase } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteBase();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/settings/", "/login", "/signup", "/auth/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
