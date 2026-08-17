import os
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    TextLoader,
)

from app.config import settings

_LOADERS = {
    ".pdf": PyPDFLoader,
    ".docx": Docx2txtLoader,
    # Markdown is read as plain text — the # / * / - characters don't hurt
    # chunking or embedding quality, and this avoids pulling in the much
    # heavier `unstructured` package just for .md files.
    ".md": TextLoader,
    ".txt": TextLoader,
}


def load_and_split(filepath: str) -> list[str]:
    ext = os.path.splitext(filepath)[1].lower()
    loader_cls = _LOADERS.get(ext)
    if loader_cls is None:
        raise ValueError(f"Unsupported file type: {ext}. Supported: pdf, docx, md, txt")

    loader = loader_cls(filepath)
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    split_docs = splitter.split_documents(docs)
    return [d.page_content for d in split_docs if d.page_content.strip()]


def sample_text_for_metadata(filepath: str, max_chars: int = 8000) -> str:
    """Extract first ~8000 chars from a file, including title/copyright/TOC pages.

    Used for LLM-based metadata detection (title, author, topic).
    Does not perform full chunking — just loads and concatenates the first
    few pages/chunks to give the model enough context for intelligent guessing.
    """
    ext = os.path.splitext(filepath)[1].lower()
    loader_cls = _LOADERS.get(ext)
    if loader_cls is None:
        raise ValueError(f"Unsupported file type: {ext}. Supported: pdf, docx, md, txt")

    loader = loader_cls(filepath)
    docs = loader.load()

    # Concatenate first several pages/chunks until we hit max_chars
    text = ""
    for doc in docs:
        text += doc.page_content + "\n\n"
        if len(text) >= max_chars:
            break

    return text[:max_chars]
