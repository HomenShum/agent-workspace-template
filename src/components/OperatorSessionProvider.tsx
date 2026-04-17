"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type OperatorSession = {
  operatorId: string;
  role: string;
  name: string;
} | null;

// Cookie mirror — so server components (/my-packs, fork actions) can read the
// session server-side without a separate auth system. Client remains the
// source of truth; this cookie is a read-through view for the server.
const OPERATOR_SESSION_COOKIE = "agent-workspace-operator-session";
// 1 year. The localStorage surface has no explicit expiry; we bound the
// cookie at a year so idle browsers eventually drop it.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function writeSessionCookie(next: OperatorSession): void {
  if (typeof document === "undefined") return;
  if (!next) {
    document.cookie = `${OPERATOR_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  // Only operatorId is needed server-side for fork keying. Keeping it minimal
  // avoids leaking the whole session into every request.
  const value = encodeURIComponent(next.operatorId);
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${OPERATOR_SESSION_COOKIE}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

const OperatorSessionContext = createContext<{
  operator: OperatorSession;
  setOperator: (next: OperatorSession) => void;
}>({
  operator: null,
  setOperator: () => {},
});

export function OperatorSessionProvider({ children }: { children: ReactNode }) {
  const [operator, setOperatorState] = useState<OperatorSession>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("agent-workspace-operator-session")
        : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as OperatorSession;
        setOperatorState(parsed);
        // Re-assert the cookie on every load. Keeps the server mirror in sync
        // if the user cleared cookies but kept localStorage, or vice versa.
        writeSessionCookie(parsed);
      } catch {
        window.localStorage.removeItem("agent-workspace-operator-session");
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      operator,
      setOperator: (next: OperatorSession) => {
        setOperatorState(next);
        if (typeof window === "undefined") return;
        if (!next) {
          window.localStorage.removeItem("agent-workspace-operator-session");
          writeSessionCookie(null);
          return;
        }
        window.localStorage.setItem("agent-workspace-operator-session", JSON.stringify(next));
        writeSessionCookie(next);
      },
    }),
    [operator]
  );

  return (
    <OperatorSessionContext.Provider value={value}>
      {children}
    </OperatorSessionContext.Provider>
  );
}

export const OPERATOR_SESSION_COOKIE_NAME = OPERATOR_SESSION_COOKIE;

export function useOperatorSession() {
  return useContext(OperatorSessionContext);
}
