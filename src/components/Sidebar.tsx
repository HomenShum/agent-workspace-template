"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOperatorSession } from "@/components/OperatorSessionProvider";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/workspace-a", label: "Workspace A" },
  { href: "/workspace-b", label: "Workspace B" },
  { href: "/chat", label: "Chat" },
];

export function Sidebar() {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <SidebarInner />
    </Suspense>
  );
}

function SidebarFallback() {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-gray-200 bg-white">
      <div className="px-4 py-4">
        <p className="text-[13px] font-bold text-gray-900">Agent Workspace</p>
      </div>
    </aside>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const { operator } = useOperatorSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const workspaces = useQuery(api.workspaces.list, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 rounded-md border border-gray-200 bg-white p-2 shadow-sm md:hidden"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-gray-200 bg-white transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <p className="text-[13px] font-bold text-gray-900">Agent Workspace</p>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded p-1 text-gray-400 hover:text-gray-600 md:hidden"
            aria-label="Close menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-2">
          <div className="space-y-0.5">
            {navLinks.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                    isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-6">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Example workspaces
            </p>
            <div className="mt-2 space-y-0.5">
              {(workspaces ?? []).map((workspace: any) => (
                <Link
                  key={workspace.workspaceId}
                  href={`/${workspace.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between rounded-md px-3 py-1 text-[13px] transition ${
                    pathname === `/${workspace.slug}`
                      ? "bg-indigo-50 font-medium text-indigo-600"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span>{workspace.label}</span>
                  <span className="text-[11px] text-gray-400">{workspace.workspaceId}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-gray-200 px-4 py-3">
          {operator ? (
            <>
              <p className="truncate text-[13px] font-medium text-gray-900">{operator.name}</p>
              <p className="text-[11px] text-gray-400">{operator.role.replace("_", " ")}</p>
            </>
          ) : (
            <p className="text-[13px] text-gray-400">No active operator session</p>
          )}
        </div>
      </aside>
    </>
  );
}
