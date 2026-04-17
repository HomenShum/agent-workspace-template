/**
 * Tiny server helper: resolve the operator's session id from the cookie
 * written by OperatorSessionProvider.
 *
 * The Provider mirrors the localStorage session to a cookie named
 * `agent-workspace-operator-session` whose value is the URL-encoded
 * operatorId. This helper decodes + re-validates defensively — cookies are
 * user-controlled and must be treated as untrusted.
 */

import { cookies } from "next/headers";
import { isValidSessionId } from "@/lib/fork-storage";

export const OPERATOR_SESSION_COOKIE = "agent-workspace-operator-session";

/**
 * Read + validate the operator session id from the request cookie store.
 * Returns null when the cookie is absent, empty, oversized, or contains
 * disallowed characters. Never throws.
 */
export async function getOperatorSessionId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(OPERATOR_SESSION_COOKIE)?.value;
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!isValidSessionId(decoded)) return null;
  return decoded;
}
