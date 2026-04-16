"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export const SHARED_GROUP_SESSION = "group-chat-general";

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-blue-500",
  "bg-pink-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeLabel(ts: number) {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface GroupChatProps {
  operatorId: string;
  operatorName: string;
}

export function GroupChat({ operatorId, operatorName }: GroupChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chat = useAction(api.agent.chat);
  const messages = useQuery(api.messages.getBySession, {
    operatorId,
    sessionId: SHARED_GROUP_SESSION,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput("");
    setLoading(true);
    try {
      await chat({
        operatorId,
        query,
        sessionId: SHARED_GROUP_SESSION,
        senderName: operatorName,
      });
    } finally {
      setLoading(false);
    }
  };

  const sorted = [...(messages ?? [])].sort((a: any, b: any) => a.createdAt - b.createdAt);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-2xl space-y-1">
          {sorted.length === 0 && !loading ? (
            <div className="py-20 text-center">
              <p className="text-2xl font-semibold text-gray-900">Welcome to # general</p>
              <p className="mt-2 text-sm text-gray-500">
                This is the shared channel for operators. The assistant rail follows the same
                session on the right.
              </p>
            </div>
          ) : null}

          {sorted.map((message: any, index: number) => {
            const isUser = message.role === "user";
            const sender = isUser ? message.senderName || "Operator" : "Agent";
            const showHeader =
              index === 0 ||
              sorted[index - 1].role !== message.role ||
              sorted[index - 1].senderName !== message.senderName;

            return (
              <div key={message._id} className={showHeader ? "mt-4" : "mt-0.5"}>
                {showHeader ? (
                  <div className="mb-1 flex items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white ${
                        isUser ? getAvatarColor(sender) : "bg-gray-800"
                      }`}
                    >
                      {isUser ? getInitials(sender) : "AI"}
                    </div>
                    <span className="text-[13px] font-semibold text-gray-900">{sender}</span>
                    <span className="text-[11px] text-gray-400">{timeLabel(message.createdAt)}</span>
                  </div>
                ) : null}
                <div className="pl-9">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-800">
                    {message.content || (message.status === "streaming" ? "..." : "")}
                  </p>
                </div>
              </div>
            );
          })}

          {loading ? (
            <div className="mt-4">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-800 text-[11px] font-bold text-white">
                  AI
                </div>
                <span className="text-[13px] font-semibold text-gray-900">Agent</span>
              </div>
              <div className="pl-9">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 transition-colors focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100">
            <input
              name="groupChatInput"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Message # general as ${operatorName}...`}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
