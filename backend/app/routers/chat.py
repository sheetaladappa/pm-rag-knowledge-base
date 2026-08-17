import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas import ChatRequest, SourceHit
from app.vector_store import similarity_search
from app.llm import condense_question, stream_answer, choose_mode

router = APIRouter(tags=["chat"])


def _sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


def _friendly_error(exc: Exception) -> str:
    """Groq's free tier reserves max_completion_tokens against an 8000 tokens/min
    budget, so a second question inside a minute is the common failure — say that
    plainly instead of surfacing a raw 413."""
    text = str(exc)
    if "rate_limit" in text or "413" in text or "429" in text:
        return (
            "Groq's rate limit was hit — the free tier allows roughly one question "
            "per minute. Wait a moment and ask again."
        )
    return f"Something went wrong generating the answer: {text}"


@router.post("/chat/stream")
def chat_stream(req: ChatRequest):
    """Streams one assistant turn as SSE: a `sources` event, then `token` events,
    then `done`. Errors arrive as an `error` event rather than a dead connection."""
    messages = [m for m in req.messages if m.content.strip()]
    if not messages or messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="Last message must be from the user.")

    question = messages[-1].content
    history = messages[:-1]

    def generate():
        try:
            search_query = condense_question(history, question)
            chunks = similarity_search(search_query, k=8)

            # Reasoning is ~85% of the output budget, so it is spent per turn only
            # where it earns its keep. A forced mode from the UI wins over the guess.
            if req.mode in ("quick", "deep"):
                mode, why = req.mode, "you chose it"
            else:
                mode, why = choose_mode(question, chunks)

            sources = [
                SourceHit(
                    document_id=(c.metadata or {}).get("document_id", "unknown"),
                    title=(c.metadata or {}).get("title", "Unknown"),
                    author=(c.metadata or {}).get("author"),
                    source=(c.metadata or {}).get("source"),
                    excerpt=c.page_content[:280],
                )
                for c in chunks
            ]
            yield _sse(
                "sources",
                {
                    "sources": [s.model_dump() for s in sources],
                    # Surfaced in the UI so a follow-up's rewrite is inspectable
                    # rather than mysterious.
                    "search_query": search_query if search_query != question else None,
                    "mode": mode,
                    "mode_reason": why,
                },
            )

            produced = False
            for delta in stream_answer(question, chunks, history, mode=mode):
                produced = True
                yield _sse("token", {"t": delta})

            if not produced:
                yield _sse(
                    "error",
                    {
                        "detail": "The model returned an empty answer — this usually "
                        "means the token budget was spent on reasoning. Try a shorter "
                        "question."
                    },
                )
            else:
                yield _sse("done", {})
        except Exception as exc:  # noqa: BLE001 — surfaced to the client verbatim
            yield _sse("error", {"detail": _friendly_error(exc)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
