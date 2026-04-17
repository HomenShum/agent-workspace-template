"use server";

/**
 * Server action fired by the "Fork to workspace" button on the pack detail
 * page. Creates a per-operator copy of the pack markdown (if missing) and
 * redirects to the editor.
 *
 * Contract:
 *   - No operator session → redirect to "/" with ?return=/packs/<slug>.
 *   - Invalid slug → throw (caller surface is a Server Action, error renders
 *     on the destination page).
 *   - Existing fork → left untouched (do NOT clobber edits). Redirect to
 *     /my-packs/<slug>/edit regardless.
 *   - New fork → write file-backed (fallback) or dispatch Convex (not
 *     reachable from a server action in this repo yet — hence the fallback).
 */

import { redirect } from "next/navigation";
import { getPackBySlug, isValidSlug } from "@/lib/pack-registry";
import { packToMarkdown } from "@/lib/pack-markdown";
import { getFork, saveFork } from "@/lib/fork-storage";
import { getOperatorSessionId } from "@/lib/fork-session";

export async function forkPackAction(slug: string): Promise<void> {
  if (!isValidSlug(slug)) {
    throw new Error("INVALID_SLUG");
  }
  const sessionId = await getOperatorSessionId();
  if (!sessionId) {
    // Send the operator to the landing with a return hint. The existing
    // OperatorSessionProvider landing flow can honor this in a follow-up.
    redirect(`/?return=${encodeURIComponent(`/packs/${slug}`)}`);
  }
  const pack = getPackBySlug(slug);
  if (!pack) {
    throw new Error("PACK_NOT_FOUND");
  }
  const existing = getFork(sessionId, slug);
  if (!existing) {
    const markdown = packToMarkdown(pack);
    const sourceVersion = pack.version ?? "0.0.0";
    const result = saveFork(sessionId, slug, markdown, sourceVersion);
    if (!result.ok) {
      // Honest status: surface the error to the action caller. Next.js will
      // render the error boundary.
      throw new Error(`FORK_CREATE_FAILED:${result.error}`);
    }
  }
  redirect(`/my-packs/${slug}/edit`);
}
