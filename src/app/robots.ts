import type { MetadataRoute } from "next";
import { PUBLIC_ORIGIN } from "@/lib/public-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/my-packs", "/chat", "/submit", "/workspace-a", "/workspace-b"] },
    sitemap: `${PUBLIC_ORIGIN}/sitemap.xml`,
  };
}
