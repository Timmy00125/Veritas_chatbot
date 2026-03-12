from fastapi import FastAPI
from app.api.endpoints import documents, chat, admin

from app.core.db import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Veritas Chatbot Backend")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router, prefix="/documents", tags=["documents"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Veritas Chatbot Backend"}
