"use client";

import Image from "next/image";
import { useState } from "react";
import { PackArtwork } from "@/components/PackArtwork";
import type { PackArtworkVariant } from "@/lib/pack-art-types";

export function PackVisual({
  slug,
  coverAssetPath,
  compact = false,
}: {
  slug: PackArtworkVariant;
  coverAssetPath?: string;
  compact?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!coverAssetPath || imageFailed) {
    return <PackArtwork variant={slug} compact={compact} />;
  }

  return (
    <div className={`pack-image-shell ${compact ? "pack-image-shell-compact" : ""}`}>
      <Image
        src={coverAssetPath}
        alt=""
        fill
        sizes={compact ? "320px" : "640px"}
        className="pack-image"
        onError={() => setImageFailed(true)}
      />
    </div>
  );
}
