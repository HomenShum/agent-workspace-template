import fs from "node:fs";
import path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const packSlugs = [
  "grounded-operator-rail",
  "planner-workers-synthesizer",
  "answer-packets-quality-gates",
  "elicitation-first-operating-system",
  "deterministic-plus-llm-hybrid",
  "durable-streaming-events",
];
const generateCover = makeFunctionReference("packArtwork:generateCover");
const getByPackSlug = makeFunctionReference("packArtwork:getByPackSlug");

const operatorId = process.argv[2] ?? "OP-003";
const outDir = path.join(process.cwd(), "public", "pack-art");

fs.mkdirSync(outDir, { recursive: true });

function readLocalConvexUrl() {
  const envPath = path.join(process.cwd(), ".env.local");
  const contents = fs.readFileSync(envPath, "utf8");
  const match = contents.match(/^NEXT_PUBLIC_CONVEX_URL=(.+)$/m);
  if (!match?.[1]) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is missing from .env.local");
  }
  return match[1].replace(/^"|"$/g, "");
}

const client = new ConvexHttpClient(readLocalConvexUrl());

for (const slug of packSlugs) {
  console.log(`Generating cover for ${slug}...`);
  await client.action(generateCover, {
    operatorId,
    packSlug: slug,
  });

  const record = await client.query(getByPackSlug, { packSlug: slug });
  if (!record?.url) {
    throw new Error(`No storage URL returned for ${slug}`);
  }

  const response = await fetch(record.url);
  if (!response.ok) {
    throw new Error(`Failed to download generated artwork for ${slug}: ${response.status}`);
  }

  const extension =
    record.mimeType === "image/png"
      ? "png"
      : record.mimeType === "image/webp"
        ? "webp"
        : record.mimeType === "image/jpeg"
          ? "jpg"
          : "bin";

  const buffer = new Uint8Array(await response.arrayBuffer());
  const targetPath = path.join(outDir, `${slug}.${extension}`);
  fs.writeFileSync(targetPath, buffer);
  console.log(`Saved ${targetPath}`);
}

console.log("Done.");
