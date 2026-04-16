"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ChatPanel } from "@/components/ChatPanel";
import { useOperatorSession } from "@/components/OperatorSessionProvider";

export function WorkspaceSurface({ workspaceSlug }: { workspaceSlug: string }) {
  const { operator } = useOperatorSession();
  const workspace = useQuery(api.workspaces.getBySlug, { slug: workspaceSlug });

  if (workspace === undefined) {
    return (
      <main className="app-shell">
        <div className="app-frame">
          <div className="glass-panel p-8">
            <p className="text-sm text-slate-500">Loading workspace...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="app-shell">
        <div className="app-frame">
          <div className="glass-panel p-8">
            <p className="section-label">Workspace Missing</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">Seed the template first.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Run <code>npm run seed</code> to create the example workspaces and operators, then
              reload this page.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell bg-[radial-gradient(circle_at_top,#eef2ff_0%,#ffffff_28%,#ffffff_100%)]">
      <div className="app-frame xl:pr-[580px]">
        <section className="glass-panel overflow-hidden px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="space-y-4">
            <p className="section-label">{workspace.eyebrow}</p>
            <h1 className="max-w-3xl text-4xl font-semibold text-slate-900 sm:text-5xl">
              {workspace.headline}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-slate-600">{workspace.description}</p>
            <div className="flex flex-wrap gap-2">
              {(workspace.samplePrompts ?? []).map((prompt: string) => (
                <span
                  key={prompt}
                  className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600"
                >
                  {prompt}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <div className="glass-panel p-6">
              <p className="section-label">Template reminder</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">
                This page is intentionally generic.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Replace the summary cards, workflows, and domain nouns only after you lock your
                schema, brief packet, tool registry, and answer packet shape.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="metric-tile">
                <p className="section-label">Persona</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{workspace.primaryPersona}</p>
              </div>
              <div className="metric-tile">
                <p className="section-label">Workspace</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{workspace.workspaceId}</p>
              </div>
              <div className="metric-tile">
                <p className="section-label">Chat mode</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">Shared rail</p>
              </div>
            </div>

            <div className="panel-strong p-6">
              <p className="section-label">Starter checklist</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>Rewrite the schema around your domain entities.</li>
                <li>Seed realistic synthetic records and sample uploads.</li>
                <li>Replace the generic tool plan with your own domain tools.</li>
                <li>Add a golden dataset before polishing the README or slides.</li>
              </ul>
            </div>
          </div>

          <div className="glass-panel p-6">
            <p className="section-label">Operator session</p>
            {operator ? (
              <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{operator.name}</p>
                <p className="mt-1 text-xs text-slate-500">{operator.role.replace("_", " ")}</p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Use this identity to test access control, shared chat behavior, and workspace
                  scoping before you add real domain roles.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-sm font-semibold text-amber-800">No operator session selected.</p>
                <p className="mt-1 text-sm leading-6 text-amber-700">
                  Choose one on the home page before entering a workspace.
                </p>
                <Link href="/" className="btn-primary mt-4 inline-flex">
                  Go to home
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {operator ? (
        <ChatPanel
          operatorId={operator.operatorId}
          operatorName={operator.name}
          workspaceId={workspace.workspaceId}
          workspaceLabel={workspace.label}
        />
      ) : null}
    </main>
  );
}
