import { useState } from "react";
import { deleteDocument } from "../api";

export default function LibraryPanel({ docs, onChanged }) {
  const [pendingId, setPendingId] = useState(null); // doc id awaiting confirmation
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");

  const confirmDelete = async (id) => {
    setDeletingId(id);
    setError("");
    try {
      await deleteDocument(id);
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Couldn't delete that document.");
    } finally {
      setDeletingId(null);
      setPendingId(null);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-600 px-2 mb-2">
        Your shelf
      </p>

      {error && <p className="text-rust-400 text-xs px-2 mb-2">{error}</p>}

      {docs.length === 0 ? (
        <p className="text-xs text-slate-600 px-2 leading-relaxed">
          Nothing indexed yet. Add a PDF, DOCX, or Markdown file below to start
          asking questions.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {docs.map((d) => (
            <li key={d.id} className="group rounded-lg px-2 py-2 hover:bg-ink-800/60">
              <p className="font-display text-sm text-parchment-50 leading-snug">
                {d.title}
              </p>
              {d.author && (
                <p className="text-xs text-slate-500 truncate">{d.author}</p>
              )}
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-[11px] font-mono text-slate-600">
                  <span
                    className={
                      d.status === "ready"
                        ? "text-moss-500"
                        : d.status === "failed"
                        ? "text-rust-400"
                        : "text-slate-500"
                    }
                  >
                    {d.status}
                  </span>
                  {d.status === "ready" && ` · ${d.chunk_count} chunks`}
                </p>

                {pendingId === d.id ? (
                  <span className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => confirmDelete(d.id)}
                      disabled={deletingId === d.id}
                      className="text-[11px] font-medium text-rust-400 hover:text-rust-500 disabled:opacity-40"
                    >
                      {deletingId === d.id ? "Removing…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setPendingId(null)}
                      className="text-[11px] text-slate-600 hover:text-slate-400"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setPendingId(d.id)}
                    className="text-[11px] text-slate-600 hover:text-rust-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
