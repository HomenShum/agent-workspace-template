"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOperatorSession } from "@/components/OperatorSessionProvider";

const proofPoints = [
  { label: "Shared channel", value: "1" },
  { label: "Example workspaces", value: "2" },
  { label: "Runtime tables", value: "8+" },
];

export default function Home() {
  const users = useQuery(api.users.listAvailable, {});
  const workspaces = useQuery(api.workspaces.list, {});
  const { operator, setOperator } = useOperatorSession();

  return (
    <main className="app-shell">
      <div className="app-frame">
        <section className="glass-panel overflow-hidden">
          <div className="grid gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1.4fr_0.8fr] lg:px-12 lg:py-12">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="section-label">Universal Agent Workspace</p>
                <div className="max-w-3xl space-y-4">
                  <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl lg:text-6xl">
                    Start from the platform, then replace the domain.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                    This repo keeps the chat rail, durable streaming, file evidence, trace
                    visibility, and answer-packet contract from FloorAI without carrying retail
                    entities into your next build.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {proofPoints.map((point) => (
                  <div key={point.label} className="metric-tile">
                    <p className="section-label">{point.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">{point.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[20px] border border-[rgba(72,57,39,0.12)] bg-white/80 p-5">
                <p className="section-label">Operator session</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Pick a sample operator before entering a workspace. Replace these demo identities
                  with your real personas after you adapt the template.
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {(users ?? []).map((user: any) => (
                    <button
                      key={user.operatorId}
                      type="button"
                      onClick={() =>
                        setOperator({
                          operatorId: user.operatorId,
                          role: user.role,
                          name: user.name,
                        })
                      }
                      className={`rounded-[18px] border px-4 py-3 text-left text-sm transition ${
                        operator?.operatorId === user.operatorId
                          ? "border-indigo-200 bg-indigo-50"
                          : "border-[rgba(72,57,39,0.12)] bg-white"
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.role.replace("_", " ")}</p>
                    </button>
                  ))}
                </div>
                {operator ? (
                  <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Active session: <span className="font-semibold text-slate-900">{operator.name}</span>
                    {" / "}
                    {operator.role.replace("_", " ")}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="panel-strong relative overflow-hidden p-5 sm:p-6">
              <div className="relative space-y-5">
                <div>
                  <p className="section-label">What to change first</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    Schema before prompts. Briefs before polish.
                  </h2>
                </div>
                <div className="space-y-3 text-sm leading-6 text-slate-600">
                  <p>
                    The template gives you the app shell and runtime contract. The real work is
                    externalizing the domain operating system so the agent has something precise to
                    execute against.
                  </p>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white/90 p-4">
                  <p className="section-label">Shipped in this template</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    <li>Shared group chat plus right-side agent rail</li>
                    <li>Convex message, event, file, audit, and answer-packet tables</li>
                    <li>Generic workspace access checks</li>
                    <li>Starter Gemini-or-fallback runtime</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          {(workspaces ?? []).map((workspace: any) => (
            <div key={workspace.workspaceId} className="glass-panel px-6 py-6 sm:px-7">
              <p className="section-label">{workspace.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-900">{workspace.label}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{workspace.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(workspace.samplePrompts ?? []).slice(0, 3).map((prompt: string) => (
                  <span
                    key={prompt}
                    className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-600"
                  >
                    {prompt}
                  </span>
                ))}
              </div>
              <div className="mt-6">
                <Link href={`/${workspace.slug}`} className="btn-primary inline-flex">
                  Open workspace
                </Link>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
