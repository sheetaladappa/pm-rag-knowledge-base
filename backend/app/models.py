import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, Integer, JSON

from app.database import Base


def new_doc_id():
    return f"doc_{uuid.uuid4().hex[:8]}"


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=new_doc_id)
    filename = Column(String, nullable=False)
    title = Column(String, nullable=False)
    topic = Column(String, nullable=True)
    source = Column(String, nullable=True)
    author = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    tags = Column(JSON, default=list)
    document_type = Column(String, default="book")
    language = Column(String, default="en")
    file_size_bytes = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    status = Column(String, default="processing")  # processing | ready | failed
