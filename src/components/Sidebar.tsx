"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOperatorSession } from "@/components/OperatorSessionProvider";

const navLinks = [
  { href: "/", label: "Directory" },
  { href: "/submit", label: "Submit" },
  { href: "/chat", label: "Studio Chat" },
  { href: "/workspace-a", label: "Builder Preview" },
  { href: "/workspace-b", label: "Reviewer Preview" },
];

export function Sidebar() {
  return (
    <Suspense fallback={<HeaderFallback />}>
      <HeaderInner />
    </Suspense>
  );
}

function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(72,57,39,0.12)] bg-[rgba(255,250,244,0.92)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-5">
        <Link href="/" className="text-base font-semibold tracking-[-0.03em] text-slate-950">
          agentworkspace.dev
        </Link>
      </div>
    </header>
  );
}

function HeaderInner() {
  const pathname = usePathname();
  const { operator } = useOperatorSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(72,57,39,0.12)] bg-[rgba(255,250,244,0.92)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-5">
          <Link href="/" className="text-base font-semibold tracking-[-0.03em] text-slate-950">
            agentworkspace.dev
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="https://github.com/HomenShum/agent-workspace-template"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[rgba(72,57,39,0.12)] bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            GitHub
          </a>
          <div className="rounded-full border border-[rgba(72,57,39,0.12)] bg-white px-3 py-2 text-xs text-slate-600">
            {operator ? (
              <>
                Active: <span className="font-semibold text-slate-950">{operator.name}</span>
              </>
            ) : (
              "No operator selected"
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          className="rounded-full border border-[rgba(72,57,39,0.12)] bg-white px-3 py-2 text-sm text-slate-700 md:hidden"
        >
          Menu
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[rgba(72,57,39,0.12)] bg-[rgba(255,250,244,0.98)] px-4 py-3 md:hidden">
          <div className="space-y-2">
            {navLinks.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-xl px-3 py-2 text-sm font-medium ${
                    isActive ? "bg-slate-950 text-white" : "bg-white text-slate-700"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <a
              href="https://github.com/HomenShum/agent-workspace-template"
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              GitHub
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
