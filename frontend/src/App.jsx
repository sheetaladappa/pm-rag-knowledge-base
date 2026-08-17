import { useEffect, useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatPanel from "./components/ChatPanel";
import { listDocuments, healthLlm, healthDb } from "./api";

export default function App() {
  const [docs, setDocs] = useState([]);
  const [llmOk, setLlmOk] = useState(null);
  const [dbOk, setDbOk] = useState(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const refreshDocs = useCallback(() => {
    listDocuments().then(setDocs).catch(() => setDocs([]));
  }, []);

  useEffect(() => {
    refreshDocs();
    healthLlm()
      .then((r) => setLlmOk(r.status === "ok"))
      .catch(() => setLlmOk(false));
    healthDb()
      .then((r) => setDbOk(r.status === "ok"))
      .catch(() => setDbOk(false));
  }, [refreshDocs]);

  return (
    <div className="h-screen flex bg-ink-950 overflow-hidden">
      <aside className="hidden md:flex w-[320px] lg:w-[360px] shrink-0">
        <Sidebar docs={docs} onChanged={refreshDocs} llmOk={llmOk} dbOk={dbOk} />
      </aside>

      {libraryOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="w-[85%] max-w-[360px]">
            <Sidebar
              docs={docs}
              onChanged={refreshDocs}
              llmOk={llmOk}
              dbOk={dbOk}
              onClose={() => setLibraryOpen(false)}
            />
          </div>
          <div
            className="flex-1 bg-ink-950/70"
            onClick={() => setLibraryOpen(false)}
          />
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <button
          onClick={() => setLibraryOpen(true)}
          className="md:hidden text-left text-xs text-slate-400 border-b border-ink-800 px-6 py-2.5 hover:text-parchment-100"
        >
          ☰ Library ({docs.length})
        </button>
        <div className="flex-1 min-h-0">
          <ChatPanel docCount={docs.length} />
        </div>
      </main>
    </div>
  );
}
