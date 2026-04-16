"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../../convex/_generated/api";
import { AttachmentList } from "./AttachmentList";
import { uploadFilesToConvex } from "@/lib/fileUploads";

interface ChatPanelProps {
  operatorId: string;
  operatorName?: string;
  workspaceId?: string;
  workspaceLabel?: string;
  sharedSessionId?: string;
}

type ParsedTrace = {
  planner?: {
    summary?: string;
    model?: string;
    plan?: Array<{
      id: string;
      stepIndex: number;
      toolName: string;
      purpose: string;
    }>;
  };
  execution?: {
    steps?: Array<{
      id: string;
      stepIndex: number;
      tool: string;
      summary: string;
      durationMs?: number;
      success?: boolean;
    }>;
    totalDurationMs?: number;
    fallbackUsed?: boolean;
  };
  sources?: Array<{
    url: string;
    domain: string;
    title?: string;
    snippet?: string;
  }>;
};

type ParsedQuality = {
  status?: string;
  summary?: string;
  checks?: Array<{
    key: string;
    label: string;
    passed: boolean;
    severity: "error" | "warning";
    message: string;
  }>;
};

type ParsedMessageMetadata = {
  answerPacketId?: string | null;
  quality?: ParsedQuality;
  trace?: ParsedTrace;
};

function parseMetadata(metadataJson?: string | null): ParsedMessageMetadata | null {
  if (!metadataJson) {
    return null;
  }

  try {
    return JSON.parse(metadataJson);
  } catch {
    return null;
  }
}

function formatDuration(durationMs?: number) {
  if (durationMs === undefined) return "n/a";
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function qualityTone(status?: string) {
  if (status === "pass") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "warning") return "border-amber-100 bg-amber-50 text-amber-700";
  if (status === "fail") return "border-rose-100 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-teal-700 underline decoration-teal-200 underline-offset-4"
            />
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-[16px] border border-[rgba(72,57,39,0.1)] bg-slate-950/95 px-4 py-3 text-[12px] leading-6 text-slate-100">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function SourceCards({ sources }: { sources?: ParsedTrace["sources"] }) {
  if (!sources?.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="section-label">Sources</p>
      {sources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-[rgba(255,252,246,0.92)] px-3 py-3 transition hover:border-teal-200 hover:bg-white"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-slate-900">{source.title || source.domain}</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
              {source.domain}
            </span>
          </div>
          {source.snippet ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{source.snippet}</p>
          ) : null}
        </a>
      ))}
    </div>
  );
}

function TraceDetails({ trace }: { trace?: ParsedTrace | null }) {
  if (!trace) return null;

  return (
    <details className="overflow-hidden rounded-[20px] border border-[rgba(72,57,39,0.12)] bg-[rgba(255,252,246,0.92)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">
        Agent trace
      </summary>
      <div className="border-t border-[rgba(72,57,39,0.08)] px-4 py-4">
        {trace.planner?.summary ? (
          <div className="mb-4 rounded-[18px] border border-[rgba(72,57,39,0.08)] bg-white px-4 py-3">
            <p className="section-label">Plan summary</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{trace.planner.summary}</p>
          </div>
        ) : null}

        {trace.planner?.plan?.length ? (
          <div className="space-y-2">
            <p className="section-label">Planned steps</p>
            {trace.planner.plan.map((step) => (
              <div
                key={step.id}
                className="rounded-[16px] border border-[rgba(72,57,39,0.08)] bg-white px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                    {step.id}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                    tier {step.stepIndex}
                  </span>
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] text-teal-700">
                    {step.toolName}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.purpose}</p>
              </div>
            ))}
          </div>
        ) : null}

        {trace.execution?.steps?.length ? (
          <div className="mt-4 space-y-2">
            <p className="section-label">Executed steps</p>
            {trace.execution.steps.map((step) => (
              <div
                key={step.id}
                className="rounded-[16px] border border-[rgba(72,57,39,0.08)] bg-white px-3 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                    {step.id}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                    {formatDuration(step.durationMs)}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] ${
                      step.success === false
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {step.success === false ? "failed" : "success"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-900">{step.tool}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.summary}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function QualityChecks({
  quality,
  answerPacketId,
}: {
  quality?: ParsedQuality;
  answerPacketId?: string | null;
}) {
  if (!quality) return null;

  return (
    <details className="overflow-hidden rounded-[20px] border border-[rgba(72,57,39,0.12)] bg-[rgba(255,252,246,0.92)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900">
        Quality checks
      </summary>
      <div className="border-t border-[rgba(72,57,39,0.08)] px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${qualityTone(quality.status)}`}>
            {quality.status || "pending"}
          </span>
          {answerPacketId ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
              {answerPacketId}
            </span>
          ) : null}
        </div>
        {quality.summary ? (
          <p className="mb-4 text-sm leading-6 text-slate-600">{quality.summary}</p>
        ) : null}
        <div className="space-y-2">
          {(quality.checks ?? []).map((check) => (
            <div
              key={check.key}
              className={`rounded-[16px] border px-3 py-3 ${
                check.passed
                  ? "border-emerald-100 bg-emerald-50/70"
                  : check.severity === "error"
                    ? "border-rose-100 bg-rose-50/70"
                    : "border-amber-100 bg-amber-50/70"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{check.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{check.message}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function formatFileSize(file: File) {
  if (file.size >= 1024 * 1024) {
    return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(file.size / 1024))} KB`;
}

export function ChatPanel({
  operatorId,
  operatorName,
  workspaceId,
  workspaceLabel,
  sharedSessionId,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useAction(api.agent.chat);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createFileRecord = useMutation(api.files.create);
  const workspace = useQuery(
    api.workspaces.getById,
    workspaceId ? { workspaceId } : "skip"
  );
  const messages = useQuery(
    api.messages.getBySession,
    sessionId ? { operatorId, sessionId, workspaceId } : "skip"
  );
  const attachments = useQuery(
    api.files.getBySession,
    sessionId ? { operatorId, sessionId, workspaceId } : "skip"
  );
  const events = useQuery(
    api.messages.getEventsBySession,
    sessionId ? { operatorId, sessionId, workspaceId } : "skip"
  );

  const scopeKey = workspaceId ?? sharedSessionId ?? "general";

  useEffect(() => {
    if (sharedSessionId) {
      setSessionId(sharedSessionId);
      return;
    }
    const storageKey = `agent-workspace-session-${scopeKey}`;
    const existing = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    const nextSession = existing || `session-${scopeKey}-${Date.now()}`;
    if (typeof window !== "undefined" && !existing) {
      window.localStorage.setItem(storageKey, nextSession);
    }
    setSessionId(nextSession);
  }, [scopeKey, sharedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sortedMessages = useMemo(
    () => [...(messages ?? [])].sort((a: any, b: any) => a.createdAt - b.createdAt),
    [messages]
  );

  const latestMetadata = useMemo(() => {
    const assistant = [...sortedMessages].reverse().find((message: any) => message.role === "assistant");
    return assistant ? parseMetadata(assistant.metadataJson) : null;
  }, [sortedMessages]);

  const latestEvent = useMemo(
    () => [...(events ?? [])].sort((a: any, b: any) => a.sequence - b.sequence).at(-1) ?? null,
    [events]
  );

  const suggestions =
    workspace?.samplePrompts ??
    [
      "What should I prioritize first?",
      "Summarize the current workspace state.",
      "What evidence or context is missing?",
    ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if ((!input.trim() && files.length === 0) || loading || !sessionId) return;

    setError(null);
    setLoading(true);
    setIsOpen(true);
    const query = input.trim() || "Review the attached evidence and summarize what matters.";
    setInput("");

    try {
      const uploadedFiles =
        files.length > 0
          ? await uploadFilesToConvex({
              files,
              generateUploadUrl,
              createFileRecord,
              context: {
                operatorId,
                sessionId,
                workspaceId,
                uploadedBy: operatorName || operatorId,
              },
            })
          : [];

      await chat({
        operatorId,
        query,
        workspaceId,
        sessionId,
        senderName: operatorName,
        fileIds: uploadedFiles.map((file) => file.fileId),
      });

      setFiles([]);
    } catch (caughtError: any) {
      setError(caughtError?.message || "The assistant could not complete that request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 rounded-[22px] border border-[rgba(72,57,39,0.12)] bg-white/95 px-4 py-3 shadow-xl backdrop-blur"
        >
          <p className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">Assistant</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{workspaceLabel || "Shared channel"}</p>
        </button>
      ) : null}

      <aside
        className={`fixed inset-y-3 right-3 z-50 flex w-[min(560px,calc(100vw-1.5rem))] flex-col rounded-[28px] border border-[rgba(72,57,39,0.12)] bg-[rgba(255,250,243,0.98)] shadow-2xl backdrop-blur transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-[110%]"
        }`}
      >
        <div className="border-b border-[rgba(72,57,39,0.08)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{workspaceLabel || "AI Assistant"}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {sharedSessionId ? "Shared channel session" : "Workspace-scoped operator rail"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
            >
              Collapse
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[rgba(72,57,39,0.08)] bg-white px-4 py-3">
              <p className="section-label">Mode</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Session retained</p>
              <p className="mt-1 text-xs text-slate-500">{sharedSessionId ? "Shared channel" : "Workspace scope"}</p>
            </div>
            <div className="rounded-[18px] border border-[rgba(72,57,39,0.08)] bg-white px-4 py-3">
              <p className="section-label">Last run</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {(latestMetadata?.trace?.execution?.steps ?? []).length} steps
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatDuration(latestMetadata?.trace?.execution?.totalDurationMs)}
              </p>
            </div>
            <div className="rounded-[18px] border border-[rgba(72,57,39,0.08)] bg-white px-4 py-3">
              <p className="section-label">Quality</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {latestMetadata?.quality?.status || "Pending"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {latestMetadata?.answerPacketId || "No answer packet yet"}
              </p>
            </div>
            <div className="rounded-[18px] border border-[rgba(72,57,39,0.08)] bg-white px-4 py-3">
              <p className="section-label">Sources</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {(latestMetadata?.trace?.sources ?? []).length} linked
              </p>
              <p className="mt-1 text-xs text-slate-500">Cross-reference ready</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {sortedMessages.length === 0 && !loading ? (
            <div className="space-y-5">
              <div className="rounded-[20px] border border-dashed border-[rgba(72,57,39,0.14)] bg-[rgba(255,252,246,0.75)] p-5">
                <p className="text-sm font-semibold text-slate-900">
                  Start by asking about this workspace.
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Replace these generic prompts after you wire the real domain brief and tool surface.
                </p>
              </div>
              <div className="grid gap-2">
                {suggestions.map((suggestion: string) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white/90 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mb-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="space-y-5">
            {sortedMessages.map((message: any) => {
              const metadata = parseMetadata(message.metadataJson);
              const messageAttachments = (attachments ?? []).filter((attachment: any) =>
                message.fileIds?.includes(attachment.fileId)
              );

              return (
                <div
                  key={message._id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`w-full max-w-[96%] rounded-[24px] px-4 py-4 ${
                      message.role === "user"
                        ? "bg-[linear-gradient(135deg,#115e59_0%,#0f766e_100%)] text-white shadow-lg"
                        : "border border-[rgba(72,57,39,0.12)] bg-white/95 shadow-[0_14px_30px_rgba(33,27,20,0.05)]"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <AssistantMarkdown content={message.content || (message.status === "streaming" ? "..." : "")} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                    )}

                    {messageAttachments.length ? (
                      <div className="mt-4">
                        <AttachmentList attachments={messageAttachments} compact />
                      </div>
                    ) : null}

                    {message.role === "assistant" ? (
                      <div className="mt-5 space-y-3">
                        <SourceCards sources={metadata?.trace?.sources} />
                        <QualityChecks
                          quality={metadata?.quality}
                          answerPacketId={metadata?.answerPacketId}
                        />
                        <TraceDetails trace={metadata?.trace ?? null} />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {loading ? (
              <div className="flex justify-start">
                <div className="w-full rounded-[20px] border border-[rgba(72,57,39,0.12)] bg-white/95 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0.3s]" />
                    </div>
                    <p className="text-xs text-slate-500">{latestEvent?.summary || "Working..."}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-[rgba(72,57,39,0.08)] bg-[rgba(255,252,246,0.92)] px-5 py-4"
        >
          {files.length ? (
            <div className="mb-3 space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-[18px] border border-[rgba(72,57,39,0.12)] bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {(file.type || "application/octet-stream").replace("/", " / ")} /{" "}
                      {formatFileSize(file)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
                    }
                    className="btn-secondary px-3 py-1.5 text-[11px]"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="btn-secondary flex w-full cursor-pointer items-center justify-center px-4 py-3 sm:w-auto">
              Attach evidence
              <input
                name="chatAttachments"
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  if (selected.length > 0) {
                    setFiles((current) => [...current, ...selected]);
                  }
                  event.target.value = "";
                }}
                disabled={loading}
              />
            </label>
            <input
              name="chatInput"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about state, evidence, next steps, or the attached files."
              className="field-input flex-1"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && files.length === 0) || !sessionId}
              className="btn-primary w-full sm:w-auto"
            >
              Send
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
