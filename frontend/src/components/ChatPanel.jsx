import { useEffect, useRef, useState } from "react";
import { streamChat, exportAnswer } from "../api";
import Markdown from "./Markdown";

const SUGGESTIONS = [
  "Explain product sense",
  "How should I structure answers in a PM interview?",
  "Where do my sources disagree on prioritization?",
  "Give me a problem statement to practice with",
];

export default function ChatPanel({ docCount }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState("auto");

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  // Follow the stream, but stop fighting the user the moment they scroll up.
  const stickToBottom = useRef(true);

  useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const patchLast = (patch) =>
    setMessages((m) => {
      if (!m.length) return m;
      const next = [...m];
      const i = next.length - 1;
      next[i] = typeof patch === "function" ? patch(next[i]) : { ...next[i], ...patch };
      return next;
    });

  const send = async (raw) => {
    const text = (raw ?? input).trim();
    if (!text || streaming) return;

    // Failed turns carry no answer, so they'd only confuse the model's context.
    const history = messages
      .filter((m) => !m.error && m.content)
      .map(({ role, content }) => ({ role, content }));
    const payload = [...history, { role: "user", content: text }];

    setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      { role: "assistant", content: "", sources: [], pending: true },
    ]);
    setStreaming(true);
    stickToBottom.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChat(payload, {
      onSources: ({ sources, search_query, mode: used, mode_reason }) =>
        patchLast({
          sources: sources || [],
          searchQuery: search_query,
          mode: used,
          modeReason: mode_reason,
        }),
      onToken: (t) =>
        patchLast((prev) => ({ ...prev, content: prev.content + t, pending: false })),
      onError: (detail) => patchLast((prev) => ({ ...prev, error: detail, pending: false })),
      signal: controller.signal,
      mode,
    });

    patchLast((prev) => ({ ...prev, pending: false }));
    setStreaming(false);
    abortRef.current = null;
  };

  const stop = () => abortRef.current?.abort();

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    stickToBottom.current = true;
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-6 py-3 border-b border-ink-800 shrink-0">
        <div className="min-w-0">
          <h2 className="font-display text-base text-parchment-50 leading-tight">
            Ask your shelf
          </h2>
          <p className="text-xs text-slate-500">
            Grounded in {docCount} indexed source{docCount !== 1 ? "s" : ""}
          </p>
        </div>
        {!empty && (
          <button
            onClick={newChat}
            className="text-xs text-slate-400 border border-ink-700 rounded-md px-3 py-1.5 hover:border-slate-500 hover:text-parchment-100 transition-colors shrink-0"
          >
            New chat
          </button>
        )}
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto min-h-0">
        {empty ? (
          <EmptyState onPick={send} disabled={docCount === 0} />
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <UserBubble key={i} text={m.content} />
              ) : (
                <AssistantTurn
                  key={i}
                  message={m}
                  question={messages[i - 1]?.content ?? ""}
                  live={streaming && i === messages.length - 1}
                />
              )
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-ink-800 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-1 mb-2">
            {[
              ["auto", "Auto", "Reason only on comparison questions"],
              ["quick", "Quick", "Never reason — fastest, weaker citations"],
              ["deep", "Deep", "Always reason — best citations, ~1 question/min"],
            ].map(([value, label, hint]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                title={hint}
                className={`text-[11px] rounded-md px-2 py-1 border transition-colors ${
                  mode === value
                    ? "border-slate-600 text-parchment-100 bg-ink-900"
                    : "border-transparent text-slate-600 hover:text-slate-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2 bg-ink-900 border border-ink-700 rounded-xl px-3 py-2 focus-within:border-slate-600 transition-colors">
            <textarea
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                docCount === 0
                  ? "Add a document to the shelf first…"
                  : "Ask a follow-up…"
              }
              disabled={docCount === 0}
              className="flex-1 bg-transparent resize-none outline-none text-[15px] text-parchment-50 placeholder:text-slate-500 py-1.5 max-h-[200px] disabled:cursor-not-allowed"
            />
            {streaming ? (
              <button
                onClick={stop}
                title="Stop generating"
                className="shrink-0 h-8 w-8 grid place-items-center rounded-lg bg-ink-700 hover:bg-ink-800 text-parchment-100 transition-colors"
              >
                <span className="block h-2.5 w-2.5 bg-current rounded-[2px]" />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim() || docCount === 0}
                title="Send"
                className="shrink-0 h-8 w-8 grid place-items-center rounded-lg bg-rust-500 hover:bg-rust-400 disabled:bg-ink-800 disabled:text-slate-600 text-parchment-50 transition-colors"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path d="M10 17V4M10 4l-5 5M10 4l5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-600 mt-2 px-1">
            Enter to send · Shift+Enter for a new line · answers cite only your shelf
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick, disabled }) {
  return (
    <div className="h-full grid place-items-center px-6 py-10">
      <div className="max-w-xl w-full text-center">
        <h3 className="font-display text-2xl text-parchment-50 mb-2">
          What do your books say?
        </h3>
        <p className="text-sm text-slate-400 mb-7">
          Answers are synthesized across every source you've indexed, with citations
          and disagreements between authors called out.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 text-left">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              disabled={disabled}
              className="text-sm text-slate-300 bg-ink-900 border border-ink-800 rounded-lg px-4 py-3 hover:border-slate-600 hover:text-parchment-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-ink-800 border border-ink-700 rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] text-parchment-50 whitespace-pre-wrap leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function AssistantTurn({ message, question, live }) {
  const { content, sources = [], error, pending, searchQuery, mode, modeReason } = message;
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const books = [...new Set(sources.map((s) => s.title).filter(Boolean))];

  const copy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = async (format) => {
    const blob = await exportAnswer({ question, answer: content, sources, format });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `answer.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {(searchQuery || mode) && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-600">
          {mode && (
            <span
              title={`${mode === "deep" ? "Reasoned before answering" : "Answered directly, no reasoning"} — ${modeReason}`}
              className={`rounded px-1.5 py-0.5 border ${
                mode === "deep"
                  ? "border-moss-600 text-moss-500"
                  : "border-ink-700 text-slate-500"
              }`}
            >
              {mode} · {modeReason}
            </span>
          )}
          {searchQuery && <span>searched: {searchQuery}</span>}
        </div>
      )}

      {pending && !content && !error && <Thinking />}

      {content && (
        <div className="relative">
          <Markdown>{content}</Markdown>
          {live && (
            <span className="inline-block align-text-bottom w-[2px] h-[1.1em] bg-moss-500 animate-pulse ml-0.5" />
          )}
        </div>
      )}

      {error && (
        <div className="border border-rust-500/40 bg-rust-500/10 rounded-lg px-4 py-3">
          <p className="text-sm text-rust-400">{error}</p>
        </div>
      )}

      {!live && content && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {books.length > 0 && (
            <button
              onClick={() => setShowSources((v) => !v)}
              className="text-xs text-slate-400 border border-ink-800 rounded-md px-2.5 py-1 hover:border-slate-600 hover:text-parchment-100 transition-colors"
            >
              {showSources ? "Hide" : "Show"} {sources.length} excerpt
              {sources.length !== 1 ? "s" : ""} from {books.length} book
              {books.length !== 1 ? "s" : ""}
            </button>
          )}
          <Action onClick={copy}>{copied ? "Copied" : "Copy"}</Action>
          <Action onClick={() => download("docx")}>Word</Action>
          <Action onClick={() => download("pdf")}>PDF</Action>
        </div>
      )}

      {showSources && sources.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-2 pt-1">
          {sources.map((s, i) => (
            <div key={i} className="bg-ink-900 border border-ink-800 rounded-lg p-3">
              <p className="text-xs font-display text-parchment-50 leading-snug">
                {s.title}
                {s.author && <span className="text-slate-500"> — {s.author}</span>}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed line-clamp-4">
                {s.excerpt}…
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Action({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-slate-500 hover:text-parchment-100 px-1.5 py-1 transition-colors"
    >
      {children}
    </button>
  );
}

function Thinking() {
  return (
    <div className="flex items-center gap-1.5 text-slate-500 text-sm">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
      <span className="ml-1.5 text-xs">searching your shelf…</span>
    </div>
  );
}
