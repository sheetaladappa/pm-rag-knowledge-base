import LibraryPanel from "./LibraryPanel";
import UploadPanel from "./UploadPanel";

export default function Sidebar({ docs, onChanged, llmOk, dbOk, onClose }) {
  return (
    <div className="flex flex-col h-full min-h-0 bg-ink-900 border-r border-ink-800">
      <div className="px-5 py-4 border-b border-ink-800 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-display text-lg text-parchment-50 leading-tight">
              PM Knowledge Base
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {docs.length} source{docs.length !== 1 ? "s" : ""} · self-hosted
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden text-slate-500 hover:text-parchment-100 text-lg leading-none px-1"
              aria-label="Close library"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex gap-3 mt-3 text-[11px] font-mono">
          <StatusDot label="LLM" ok={llmOk} />
          <StatusDot label="Vector DB" ok={dbOk} />
        </div>
      </div>

      <LibraryPanel docs={docs} onChanged={onChanged} />
      <UploadPanel onUploaded={onChanged} />
    </div>
  );
}

function StatusDot({ label, ok }) {
  const color = ok === null ? "bg-slate-600" : ok ? "bg-moss-500" : "bg-rust-500";
  return (
    <div className="flex items-center gap-1.5 text-slate-500">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
