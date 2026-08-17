import os
import shutil

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Document
from app.schemas import DocumentOut, MetadataDetection
from app.document_processor import load_and_split, sample_text_for_metadata
from app.vector_store import add_chunks, delete_document_chunks
from app.llm import detect_metadata

router = APIRouter(prefix="/documents", tags=["documents"])

os.makedirs(settings.upload_dir, exist_ok=True)


def _current_storage_mb(db: Session) -> float:
    total = 0
    for doc in db.query(Document).all():
        total += doc.file_size_bytes or 0
    return total / (1024 * 1024)


@router.get("", response_model=list[DocumentOut])
def list_documents(topic: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Document)
    if topic:
        query = query.filter(Document.topic == topic)
    return query.order_by(Document.uploaded_at.desc()).all()


@router.post("/detect-metadata", response_model=MetadataDetection)
async def detect_metadata_from_file(file: UploadFile = File(...)):
    """Preview endpoint: extract and guess metadata from a document's first pages.

    Accepts a single file, returns guessed title/author/topic as JSON.
    Does NOT save the file or create a database entry — purely for preview.
    Fails gracefully: if detection fails, returns empty strings.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".docx", ".md", ".txt"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Use PDF, DOCX, Markdown, or text.",
        )

    temp_path = None
    try:
        # Save to a temp file for processing
        os.makedirs(settings.upload_dir, exist_ok=True)
        temp_path = os.path.join(settings.upload_dir, f"temp_{os.urandom(8).hex()}{ext}")
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Extract first few pages for metadata detection
        text_sample = sample_text_for_metadata(temp_path)

        # Run LLM detection
        metadata = detect_metadata(text_sample)

        return MetadataDetection(**metadata)
    except Exception:
        # Fail gracefully: return empty strings if anything goes wrong
        return MetadataDetection(title="", author="", topic="")
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass


@router.post("/upload", response_model=list[DocumentOut])
async def upload_documents(
    files: list[UploadFile] = File(...),
    title: str | None = Form(None),
    topic: str | None = Form(None),
    source: str | None = Form(None),
    author: str | None = Form(None),
    tags: str | None = Form(None),  # comma-separated
    document_type: str = Form("book"),
    db: Session = Depends(get_db),
):
    """Supports single or bulk upload. If multiple files are sent, title/topic/etc.
    apply to all of them (bulk metadata); edit later isn't supported per the plan."""

    if _current_storage_mb(db) >= settings.max_storage_mb:
        raise HTTPException(status_code=413, detail="Storage limit reached")

    tag_list = [t.strip() for t in tags.split(",")] if tags else []
    created = []

    for upload in files:
        ext = os.path.splitext(upload.filename)[1].lower()
        if ext not in (".pdf", ".docx", ".md", ".txt"):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{ext}'. Use PDF, DOCX, or Markdown.",
            )

        doc = Document(
            filename=upload.filename,
            title=title or os.path.splitext(upload.filename)[0],
            topic=topic,
            source=source,
            author=author,
            tags=tag_list,
            document_type=document_type,
            status="processing",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        dest_path = os.path.join(settings.upload_dir, f"{doc.id}{ext}")
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(upload.file, f)
        doc.file_size_bytes = os.path.getsize(dest_path)

        try:
            chunks = load_and_split(dest_path)
            metadatas = [
                {
                    "document_id": doc.id,
                    "title": doc.title,
                    "topic": doc.topic,
                    "source": doc.source,
                    "author": doc.author,
                    "tags": doc.tags,
                }
                for _ in chunks
            ]
            add_chunks(chunks, metadatas)
            doc.chunk_count = len(chunks)
            doc.status = "ready"
        except Exception as e:
            doc.status = "failed"
            db.commit()
            raise HTTPException(status_code=500, detail=f"Processing failed for {upload.filename}: {e}")

        db.commit()
        db.refresh(doc)
        created.append(doc)

    return created


@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Try to delete vectors, but don't fail if Qdrant has issues
    try:
        delete_document_chunks(document_id)
    except Exception as e:
        print(f"Warning: Could not delete vectors from Qdrant: {e}")

    # Delete uploaded file
    for ext in (".pdf", ".docx", ".md", ".txt"):
        path = os.path.join(settings.upload_dir, f"{document_id}{ext}")
        if os.path.exists(path):
            os.remove(path)

    # Delete from database
    db.delete(doc)
    db.commit()
    return {"deleted": document_id}
