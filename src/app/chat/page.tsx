"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { GroupChat, SHARED_GROUP_SESSION } from "@/components/GroupChat";
import { useOperatorSession } from "@/components/OperatorSessionProvider";

function ChatPreviewShell() {
  return (
    <div className="min-h-[calc(100vh-16px)] bg-[radial-gradient(circle_at_top,#eef2ff_0%,#ffffff_32%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-[calc(100vh-16px)] max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8 xl:pr-[580px]">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          <header className="mb-4 rounded-[24px] border border-[rgba(72,57,39,0.12)] bg-white/95 px-6 py-5 shadow-[0_18px_40px_rgba(33,27,20,0.05)] backdrop-blur">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Shared Channel
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  Group chat with a live agent rail
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  The shared channel stays in the center. The agent rail stays on the right for
                  plan trace, sources, telemetry, and quality checks.
                </p>
              </div>
              <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Operator session required
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden rounded-[28px] border border-[rgba(72,57,39,0.12)] bg-white shadow-[0_20px_40px_rgba(33,27,20,0.06)]">
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
              <p className="text-2xl font-semibold text-slate-900">Welcome to # general</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Pick an operator identity first so the shared channel and the agent rail can enforce
                the right workspace scope.
              </p>
              <Link href="/" className="btn-primary mt-8 inline-flex">
                Choose operator session
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatPageInner() {
  const { operator } = useOperatorSession();

  if (!operator) {
    return <ChatPreviewShell />;
  }

  return (
    <div className="min-h-[calc(100vh-16px)] bg-[radial-gradient(circle_at_top,#eef2ff_0%,#ffffff_32%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-[calc(100vh-16px)] max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8 xl:pr-[580px]">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          <header className="mb-4 rounded-[24px] border border-[rgba(72,57,39,0.12)] bg-white/95 px-6 py-5 shadow-[0_18px_40px_rgba(33,27,20,0.05)] backdrop-blur">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Shared Channel
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  Group chat with a live operator rail
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  The centered channel is where operators talk together. The right rail follows the
                  same shared session and exposes the assistant trace, telemetry, sources, and quality checks.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Signed in as <span className="font-semibold text-slate-800">{operator.name}</span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-hidden rounded-[28px] border border-[rgba(72,57,39,0.12)] bg-white shadow-[0_20px_40px_rgba(33,27,20,0.06)]">
            <GroupChat operatorId={operator.operatorId} operatorName={operator.name} />
          </div>
        </div>
      </div>

      <ChatPanel
        operatorId={operator.operatorId}
        operatorName={operator.name}
        sharedSessionId={SHARED_GROUP_SESSION}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-400">Loading chat...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}
