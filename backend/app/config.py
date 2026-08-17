from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    groq_api_key: str | None = None
    llm_model: str = "qwen/qwen3.6-27b"
    # "hidden" strips the <think> block reasoning models emit; set to None for
    # non-reasoning models (e.g. llama-3.3-70b-versatile), which reject the param.
    llm_reasoning_format: str | None = "hidden"
    # "none" disables thinking (~1.5s/answer); "default" thinks first (~5s/answer) and
    # is markedly better at citing sources by name and spotting where sources differ.
    llm_reasoning_effort: str | None = "default"
    # Deep-mode budget. Must cover reasoning tokens *plus* the answer — the provider
    # default of 2048 is spent almost entirely on reasoning, which truncates or empties
    # the answer. Measured on this model: ~2.9k reasoning + ~0.5k answer. Groq bills
    # this *reserved* budget against the free tier's 8000 tokens/min, so the ceiling is
    # 8000 minus the prompt (~1.9k): 8192 exceeds it on its own and 413s every time.
    llm_max_tokens: int = 5000
    # Quick mode skips reasoning, so it only needs room for the answer itself. Lowering
    # the reservation alongside the effort is what actually buys throughput — Groq
    # charges the reservation, so `reasoning_effort=none` at 5000 would save nothing.
    llm_quick_max_tokens: int = 1200
    qdrant_host: str = "http://localhost:6333"
    qdrant_api_key: str | None = None  # set this when qdrant_host points to Qdrant Cloud
    qdrant_collection: str = "pm_knowledge_base"
    sqlite_path: str = "./data/pmrag.db"
    upload_dir: str = "./data/uploads"
    max_storage_mb: int = 1024
    embedding_model: str = "BAAI/bge-small-en-v1.5"  # 384-dim, matches Qdrant collection config
    chunk_size: int = 1000
    chunk_overlap: int = 150

    class Config:
        env_file = ".env"


settings = Settings()
