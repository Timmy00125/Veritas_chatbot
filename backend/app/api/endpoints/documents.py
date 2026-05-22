import asyncio
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.db import get_db
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.core.config import settings
from app.services.gemini_documents import (
    is_dns_resolution_error,
    normalize_file_status,
)
import uuid
import os
import shutil
import re
import logging
from google import genai
from supabase import create_client, Client

router = APIRouter()
logger = logging.getLogger(__name__)

try:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception:
    client = None

supabase: Client | None = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        logger.warning("Failed to initialize Supabase client: %s", e)


def _sanitize_filename(filename: str) -> str:
    """Return a filesystem-safe filename."""
    # Strip path separators and control characters
    filename = re.sub(r"[^\w\s.-]", "", filename)
    filename = re.sub(r"\s+", "_", filename)
    # Prevent hidden files and directory traversal
    filename = filename.lstrip(".")
    if not filename:
        filename = "unnamed"
    return filename


def _ensure_bucket_exists() -> None:
    """Create the configured Supabase bucket if it does not exist."""
    if not supabase:
        return
    try:
        buckets = supabase.storage.list_buckets()
        bucket_names = {b.name for b in buckets}
        if settings.SUPABASE_BUCKET not in bucket_names:
            supabase.storage.create_bucket(
                settings.SUPABASE_BUCKET,
                {"public": True},
            )
            logger.info("Created Supabase bucket: %s", settings.SUPABASE_BUCKET)
    except Exception as e:
        logger.warning("Could not verify/create Supabase bucket: %s", e)


# Run bucket check once at import time
_ensure_bucket_exists()


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    allowed_types = [
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, detail=f"Unsupported file type: {file.content_type}"
        )

    file_id = uuid.uuid4()
    safe_name = _sanitize_filename(file.filename or "unnamed")
    temp_file_path = f"/tmp/{file_id}_{safe_name}"
    supabase_file_url = None
    supabase_file_path = None

    try:
        # Stream file to disk to avoid loading large files into memory
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Upload to Supabase Storage if configured
        if supabase:
            try:
                file_path_in_bucket = f"{file_id}_{safe_name}"
                await asyncio.to_thread(
                    supabase.storage.from_(settings.SUPABASE_BUCKET).upload,
                    file=temp_file_path,
                    path=file_path_in_bucket,
                    file_options={"content-type": file.content_type},
                )
                supabase_file_url = supabase.storage.from_(
                    settings.SUPABASE_BUCKET
                ).get_public_url(file_path_in_bucket)
                supabase_file_path = file_path_in_bucket
            except Exception as e:
                logger.warning("Supabase upload failed: %s", e)

        # Upload to Gemini File API
        if client:
            gemini_file = await asyncio.to_thread(
                client.files.upload,
                file=temp_file_path,
                config={"display_name": safe_name},
            )
            gemini_file_id = gemini_file.name
            gemini_file_uri = gemini_file.uri
            status = normalize_file_status(getattr(gemini_file, "state", None))
        else:
            gemini_file_id = f"mock_file_{file_id}"
            gemini_file_uri = f"mock://{gemini_file_id}"
            status = "ACTIVE"

        db_document = Document(
            filename=safe_name,
            gemini_file_id=gemini_file_id,
            gemini_file_uri=gemini_file_uri,
            supabase_file_url=supabase_file_url,
            supabase_file_path=supabase_file_path,
            mime_type=file.content_type,
            status=status,
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        return db_document

    except Exception as e:
        db.rollback()
        if is_dns_resolution_error(e):
            raise HTTPException(
                status_code=503,
                detail=(
                    "Gemini API hostname could not be resolved from the backend "
                    "container. Verify Docker DNS and outbound internet access."
                ),
            ) from e
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


@router.get("/", response_model=List[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    """Return all uploaded documents."""
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    """Delete a document by ID. Also removes it from the Gemini File API and Supabase if possible."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Attempt to delete from Gemini File API
    if (
        client
        and doc.gemini_file_id
        and not doc.gemini_file_id.startswith("mock_file_")
    ):
        try:
            client.files.delete(name=doc.gemini_file_id)
        except Exception:
            pass

    # Attempt to delete from Supabase Storage using stored path
    if supabase and doc.supabase_file_path:
        try:
            supabase.storage.from_(settings.SUPABASE_BUCKET).remove(
                [doc.supabase_file_path]
            )
        except Exception as e:
            logger.warning("Supabase delete failed: %s", e)

    db.delete(doc)
    db.commit()
