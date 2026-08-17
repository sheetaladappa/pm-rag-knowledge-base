import requests
from fastapi import APIRouter

from app.config import settings
from app.vector_store import get_client

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health():
    return {"status": "ok"}


@router.get("/llm")
def health_llm():
    """Confirm Groq is reachable and the configured model is actually served."""
    try:
        r = requests.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            timeout=5,
        )
        r.raise_for_status()
        available = [m["id"] for m in r.json().get("data", [])]
        if settings.llm_model not in available:
            return {
                "status": "unavailable",
                "model": settings.llm_model,
                "error": "model not served by Groq",
            }
        return {"status": "ok", "model": settings.llm_model}
    except Exception as e:
        return {"status": "unavailable", "model": settings.llm_model, "error": str(e)}


@router.get("/db")
def health_db():
    try:
        client = get_client()
        client.get_collections()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "unavailable", "error": str(e)}
