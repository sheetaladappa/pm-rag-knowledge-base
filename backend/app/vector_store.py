from langchain_community.embeddings import FastEmbedEmbeddings
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, Filter, FieldCondition, MatchValue

from app.config import settings

_embeddings = None
_client = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = FastEmbedEmbeddings(model_name=settings.embedding_model)
    return _embeddings


def get_client():
    global _client
    if _client is None:
        _client = QdrantClient(
            url=settings.qdrant_host,
            api_key=settings.qdrant_api_key,  # None for local Qdrant, required for Qdrant Cloud
        )
    return _client


def ensure_collection():
    client = get_client()
    collections = [c.name for c in client.get_collections().collections]
    if settings.qdrant_collection not in collections:
        client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )

    # Create index for document_id filtering (required for deletion)
    try:
        client.create_payload_index(
            collection_name=settings.qdrant_collection,
            field_name="metadata.document_id",
            field_schema="keyword",
        )
    except Exception:
        pass


def get_vector_store():
    ensure_collection()
    return QdrantVectorStore(
        client=get_client(),
        collection_name=settings.qdrant_collection,
        embedding=get_embeddings(),
    )


def add_chunks(chunks, metadatas):
    """chunks: list[str], metadatas: list[dict] (must include document_id, title, etc.)"""
    store = get_vector_store()
    store.add_texts(texts=chunks, metadatas=metadatas)


def similarity_search(query: str, k: int = 8, topic: str | None = None):
    store = get_vector_store()
    search_filter = None
    if topic:
        search_filter = Filter(
            must=[FieldCondition(key="metadata.topic", match=MatchValue(value=topic))]
        )
    return store.similarity_search(query, k=k, filter=search_filter)


def delete_document_chunks(document_id: str):
    client = get_client()
    client.delete(
        collection_name=settings.qdrant_collection,
        points_selector=Filter(
            must=[FieldCondition(key="metadata.document_id", match=MatchValue(value=document_id))]
        ),
    )
