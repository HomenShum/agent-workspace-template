"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type OperatorSession = {
  operatorId: string;
  role: string;
  name: string;
} | null;

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
        setOperatorState(JSON.parse(stored));
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
          return;
        }
        window.localStorage.setItem("agent-workspace-operator-session", JSON.stringify(next));
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

export function useOperatorSession() {
  return useContext(OperatorSessionContext);
}
