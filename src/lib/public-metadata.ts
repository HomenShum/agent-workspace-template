import type { Metadata } from "next";

// The existing Vercel project serves this custom domain as its public catalog.
export const PUBLIC_ORIGIN = "https://agentworkspace.attrition.sh";

export function publicMetadata(path: string, title: string, description: string): Metadata {
  const url = new URL(path, PUBLIC_ORIGIN).href;
  return {
    title: { absolute: `${title} | Agent Workspace` },
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Agent Workspace", type: "website" },
    twitter: { card: "summary", title, description },
  };
}
