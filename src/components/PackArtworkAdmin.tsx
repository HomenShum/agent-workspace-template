"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOperatorSession } from "@/components/OperatorSessionProvider";
import type { HarnessPack } from "@/lib/harness-packs";

export function PackArtworkAdmin({ pack }: { pack: HarnessPack }) {
  const convexEnabled = !!process.env.NEXT_PUBLIC_CONVEX_URL;
  const { operator } = useOperatorSession();
  const artwork = useQuery(
    api.packArtwork.getByPackSlug,
    convexEnabled ? { packSlug: pack.slug } : "skip",
  );
  const generateCover = useAction(api.packArtwork.generateCover);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!convexEnabled) {
    return null;
  }

  async function onGenerate() {
    if (!operator) {
      setMessage("Select an operator session to generate Gemini cover art.");
      return;
    }

    setIsGenerating(true);
    setMessage(null);

    try {
      const result = await generateCover({
        operatorId: operator.operatorId,
        packSlug: pack.slug,
      });
      setMessage(`Generated ${result.model} cover art for ${pack.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cover generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="glass-panel px-6 py-6">
      <p className="section-label">Gemini cover art</p>
      <div className="mt-3 space-y-3">
        <p className="text-sm leading-6 text-slate-600">
          Generate and persist a refreshed cover image through Convex storage using Gemini image
          generation. This updates the local review artifact even when the public site is still
          serving the checked-in fallback cover.
        </p>
        <div className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-4 text-sm text-slate-700">
          <p>
            Status:{" "}
            <span className="font-semibold text-slate-950">
              {artwork?.status ?? "no generated cover recorded"}
            </span>
          </p>
          {artwork?.model ? (
            <p className="mt-2 text-xs text-slate-500">Last model: {artwork.model}</p>
          ) : null}
          {artwork?.url ? (
            <a
              href={artwork.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-xs font-medium text-slate-950 underline underline-offset-4"
            >
              Open generated asset
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onGenerate} disabled={isGenerating} className="btn-secondary">
            {isGenerating ? "Generating..." : "Generate Gemini cover"}
          </button>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
