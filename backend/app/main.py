from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import documents, query, chat, export, health

app = FastAPI(title="PM Knowledge Base RAG API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # local self-hosted single-user tool; tighten if exposed
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(documents.router)
app.include_router(query.router)
app.include_router(chat.router)
app.include_router(export.router)
app.include_router(health.router)


@app.get("/")
def root():
    return {"message": "PM Knowledge Base RAG API is running. See /docs for endpoints."}
