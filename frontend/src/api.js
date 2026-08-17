import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_URL });

export const listDocuments = (topic) =>
  api.get("/documents", { params: topic ? { topic } : {} }).then((r) => r.data);

export const detectMetadata = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post("/documents/detect-metadata", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data)
    .catch(() => ({ title: "", author: "", topic: "" }));
};

export const uploadDocuments = (files, meta) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  Object.entries(meta).forEach(([k, v]) => {
    if (v) form.append(k, v);
  });
  return api
    .post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const askQuestion = (question, topic) =>
  api.post("/query", { question, topic }).then((r) => r.data);

/**
 * Streams one assistant turn. `messages` is the whole conversation so far,
 * ending with the new user turn. Returns once the stream closes; abort mid-flight
 * via `signal`.
 *
 * Uses fetch rather than axios because axios buffers the whole response body —
 * there is no incremental read, which is the entire point here.
 */
export async function streamChat(
  messages,
  { onSources, onToken, onError, signal, mode = "auto" }
) {
  let res;
  try {
    res = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, mode }),
      signal,
    });
  } catch (err) {
    if (err.name !== "AbortError") onError?.("Couldn't reach the backend.");
    return;
  }

  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body — keep the status-code message */
    }
    onError?.(detail);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line; a partial frame stays buffered.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        let event = "message";
        const dataLines = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;

        let payload;
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch {
          continue;
        }

        if (event === "sources") onSources?.(payload);
        else if (event === "token") onToken?.(payload.t);
        else if (event === "error") onError?.(payload.detail);
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") onError?.("The connection dropped mid-answer.");
  }
}

export const exportAnswer = (payload) =>
  api
    .post("/export", payload, { responseType: "blob" })
    .then((r) => r.data);

export const deleteDocument = (id) =>
  api.delete(`/documents/${id}`).then((r) => r.data);

export const health = () => api.get("/health").then((r) => r.data);
export const healthLlm = () => api.get("/health/llm").then((r) => r.data);
export const healthDb = () => api.get("/health/db").then((r) => r.data);
