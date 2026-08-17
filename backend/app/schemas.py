from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MetadataDetection(BaseModel):
    title: str = ""
    author: str = ""
    topic: str = ""


class DocumentOut(BaseModel):
    id: str
    filename: str
    title: str
    topic: Optional[str] = None
    source: Optional[str] = None
    author: Optional[str] = None
    uploaded_at: datetime
    tags: list[str] = []
    document_type: str = "book"
    language: str = "en"
    chunk_count: int = 0
    status: str = "processing"

    class Config:
        from_attributes = True


class QueryRequest(BaseModel):
    question: str
    topic: Optional[str] = None  # optional filter, per "filter by topic"
    compare_sources: bool = True
    highlight_contradictions: bool = True


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    """Full conversation so far. The last message must be the new user turn."""

    messages: list[ChatMessage]
    # "auto" picks per turn; "quick"/"deep" force it. Any heuristic guesses wrong
    # sometimes, so the UI can override it.
    mode: str = "auto"


class SourceHit(BaseModel):
    document_id: str
    title: str
    author: Optional[str] = None
    source: Optional[str] = None
    excerpt: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceHit]
    timestamp: datetime


class ExportRequest(BaseModel):
    question: str
    answer: str
    sources: list[SourceHit] = []
    format: str  # "pdf" | "docx"
