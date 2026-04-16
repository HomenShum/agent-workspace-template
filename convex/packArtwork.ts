import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { harnessPacks } from "../src/lib/harness-packs";

const DEFAULT_IMAGE_MODEL =
  process.env.PACK_ART_MODEL ??
  // Preview image model per Google Gemini 3 docs, April 2026.
  "gemini-3.1-flash-image-preview";

function decodeBase64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getPack(slug: string) {
  return harnessPacks.find((pack) => pack.slug === slug);
}

function buildArtworkPrompt(slug: string) {
  const pack = getPack(slug);
  if (!pack) {
    throw new Error(`Unknown pack slug: ${slug}`);
  }

  return [
    "Create a polished hero illustration for a developer tooling marketplace card.",
    `Theme: ${pack.name}.`,
    `Tagline: ${pack.tagline}`,
    `Focus concepts: ${pack.tags.join(", ")}.`,
    "Style: premium editorial product art, geometric, crisp, modern, vector-like depth, no text, no letters, no UI screenshots, no logos, no watermark, no people, no photorealism.",
    "Palette: warm ivory background accents, graphite structure, restrained amber, teal, and soft sky highlights.",
    "Composition: clean center-weighted composition that communicates the workflow concept at a glance.",
    "Output: a single 16:9 landscape cover image.",
  ].join(" ");
}

export const getByPackSlug = query({
  args: { packSlug: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("packArtwork")
      .withIndex("by_packSlug", (q) => q.eq("packSlug", args.packSlug))
      .first();

    if (!record) {
      return null;
    }

    return {
      ...record,
      url: record.storageId ? await ctx.storage.getUrl(record.storageId) : null,
    };
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("packArtwork").collect();
    return await Promise.all(
      records.map(async (record) => ({
        ...record,
        url: record.storageId ? await ctx.storage.getUrl(record.storageId) : null,
      })),
    );
  },
});

export const saveGenerated = internalMutation({
  args: {
    packSlug: v.string(),
    prompt: v.string(),
    model: v.string(),
    status: v.string(),
    generatedBy: v.string(),
    mimeType: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
    generatedAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("packArtwork")
      .withIndex("by_packSlug", (q) => q.eq("packSlug", args.packSlug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        prompt: args.prompt,
        model: args.model,
        status: args.status,
        generatedBy: args.generatedBy,
        mimeType: args.mimeType,
        storageId: args.storageId,
        notes: args.notes,
        generatedAt: args.generatedAt,
        updatedAt: args.updatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("packArtwork", args);
  },
});

export const generateCover = action({
  args: {
    operatorId: v.string(),
    packSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const operator = await ctx.runQuery(api.users.getById, {
      operatorId: args.operatorId,
    });

    if (!operator) {
      throw new Error("Operator session is missing or invalid.");
    }

    const pack = getPack(args.packSlug);
    if (!pack) {
      throw new Error(`Unknown pack slug: ${args.packSlug}`);
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GOOGLE_API_KEY in Convex env.");
    }

    const prompt = buildArtworkPrompt(args.packSlug);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_IMAGE_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            imageConfig: {
              aspectRatio: "16:9",
              imageSize: "2K",
            },
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini image generation failed with ${response.status}.`);
    }

    const payload = await response.json();
    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part: any) => part?.inlineData?.mimeType?.startsWith("image/"));

    if (!imagePart?.inlineData?.data) {
      throw new Error("Gemini returned no image data.");
    }

    const mimeType = imagePart.inlineData.mimeType as string;
    const imageBytes = decodeBase64ToBytes(imagePart.inlineData.data);
    const storageId = await ctx.storage.store(new Blob([imageBytes], { type: mimeType }));
    const textPart = parts.find((part: any) => typeof part?.text === "string" && part.text.trim().length > 0);
    const now = Date.now();

    await ctx.runMutation(internal.packArtwork.saveGenerated, {
      packSlug: args.packSlug,
      prompt,
      model: DEFAULT_IMAGE_MODEL,
      status: "ready",
      generatedBy: operator.operatorId,
      mimeType,
      storageId,
      notes: textPart?.text,
      generatedAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.audit.record, {
      actorId: args.operatorId,
      eventType: "pack.art.generated",
      status: "success",
      entityId: args.packSlug,
      summary: `Generated Gemini cover art for ${pack.name}.`,
      detailsJson: JSON.stringify({
        model: DEFAULT_IMAGE_MODEL,
        mimeType,
      }),
    });

    return {
      packSlug: args.packSlug,
      model: DEFAULT_IMAGE_MODEL,
      mimeType,
      prompt,
      storageId,
      url: await ctx.storage.getUrl(storageId),
    };
  },
});
