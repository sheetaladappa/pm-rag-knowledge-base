from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas import QueryRequest, QueryResponse, SourceHit
from app.vector_store import similarity_search
from app.llm import answer_question

router = APIRouter(tags=["query"])


@router.post("/query", response_model=QueryResponse)
def query_knowledge_base(req: QueryRequest):
    chunks = similarity_search(req.question, k=8, topic=req.topic)

    answer = answer_question(req.question, chunks)

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

    return QueryResponse(
        answer=answer,
        sources=sources,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/answer")
def answer_only(req: QueryRequest):
    """Plain-text-focused variant of /query, per the API design in the plan."""
    chunks = similarity_search(req.question, k=8, topic=req.topic)
    answer = answer_question(req.question, chunks)
    return {"answer": answer}
