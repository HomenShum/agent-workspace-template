import type { MetadataRoute } from "next";
import { getAllPacks } from "@/lib/pack-registry";
import { publisherProfiles } from "@/lib/harness-packs";
import { getAllTraces } from "@/lib/trace-registry";
import { PUBLIC_ORIGIN } from "@/lib/public-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  // Public documents only. No fabricated modification times or query permutations.
  return ["/", "/compare", "/traces",
    ...getAllPacks().map((pack) => `/packs/${pack.slug}`),
    ...Object.values(publisherProfiles).map((publisher) => `/publishers/${publisher.slug}`),
    ...getAllTraces().map((trace) => `/traces/${trace.id}`),
  ].map((path) => ({ url: new URL(path, PUBLIC_ORIGIN).href }));
}
