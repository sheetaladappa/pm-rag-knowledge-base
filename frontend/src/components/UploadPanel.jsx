import { useState, useRef } from "react";
import { uploadDocuments, detectMetadata } from "../api";

export default function UploadPanel({ onUploaded }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState(null); // null | "detecting" | "uploading" | "done" | "error"
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    const newFiles = Array.from(e.dataTransfer.files);
    setFiles(newFiles);
    setOpen(true);
    runMetadataDetection(newFiles);
  };

  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(newFiles);
    runMetadataDetection(newFiles);
  };

  const runMetadataDetection = async (filesToDetect) => {
    if (filesToDetect.length === 0) return;
    setStatus("detecting");
    setErrorMsg("");
    // Only detect metadata for the first file (for bulk upload, user manually edits)
    const firstFile = filesToDetect[0];
    const detected = await detectMetadata(firstFile);
    setTitle(detected.title || "");
    setTopic(detected.topic || "");
    setAuthor(detected.author || "");
    setSource(""); // Source (book/blog) is not auto-detected, let user fill
    setTags("");
    setStatus(null);
  };

  const submit = async () => {
    if (files.length === 0) return;
    setStatus("uploading");
    setErrorMsg("");
    try {
      await uploadDocuments(files, { title, topic, author, source, tags });
      setStatus("done");
      setFiles([]);
      setTitle("");
      setTopic("");
      setAuthor("");
      setSource("");
      setTags("");
      onUploaded?.();
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err?.response?.data?.detail || "Upload failed.");
    }
  };

  const field =
    "w-full bg-ink-950 border border-ink-800 rounded-md px-2.5 py-1.5 text-xs text-parchment-50 placeholder:text-slate-600 focus:border-slate-600 outline-none";

  return (
    <div className="shrink-0 border-t border-ink-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs text-slate-400 hover:text-parchment-100 transition-colors"
      >
        <span>+ Add to shelf</span>
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>⌃</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 max-h-[52vh] overflow-y-auto">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border border-dashed border-ink-700 hover:border-moss-500 transition-colors rounded-lg p-4 text-center cursor-pointer"
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.md,.txt"
              className="hidden"
              onChange={handleFileSelect}
            />
            {files.length === 0 ? (
              <p className="text-slate-500 text-xs">
                Drop files here, or click to browse
              </p>
            ) : (
              <ul className="text-xs text-parchment-100 space-y-0.5 font-mono text-left">
                {files.map((f) => (
                  <li key={f.name} className="truncate">
                    {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {status === "detecting" && (
            <p className="text-slate-500 text-xs">Detecting metadata…</p>
          )}

          <input className={field} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={field} placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <input className={field} placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
          <input className={field} placeholder="Tags, comma separated" value={tags} onChange={(e) => setTags(e.target.value)} />

          <button
            onClick={submit}
            disabled={files.length === 0 || status === "uploading" || status === "detecting"}
            className="w-full bg-moss-600 hover:bg-moss-500 disabled:opacity-40 disabled:cursor-not-allowed text-parchment-50 rounded-md px-3 py-2 text-xs font-medium transition-colors"
          >
            {status === "uploading" ? "Indexing…" : "Upload & index"}
          </button>

          {status === "done" && (
            <p className="text-moss-500 text-xs">Added to the knowledge base.</p>
          )}
          {status === "error" && <p className="text-rust-400 text-xs">{errorMsg}</p>}
        </div>
      )}
    </div>
  );
}
