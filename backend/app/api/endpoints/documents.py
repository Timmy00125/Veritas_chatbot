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
    refresh_document_statuses,
)
import uuid
import os
from google import genai
from supabase import create_client, Client

router = APIRouter()

try:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception:
    client = None

supabase: Client | None = None
if settings.SUPABASE_URL and settings.SUPABASE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase client: {e}")


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

    # Save file temporarily to upload to Gemini and Supabase
    file_id = uuid.uuid4()
    temp_file_path = f"/tmp/{file_id}_{file.filename}"
    supabase_file_url = None
    try:
        file_bytes = await file.read()
        with open(temp_file_path, "wb") as f:
            f.write(file_bytes)

        # Upload to Supabase Storage if configured
        if supabase:
            try:
                file_path_in_bucket = f"{file_id}_{file.filename}"
                supabase.storage.from_("documents").upload(
                    file=temp_file_path,
                    path=file_path_in_bucket,
                    file_options={"content-type": file.content_type}
                )
                supabase_file_url = supabase.storage.from_("documents").get_public_url(file_path_in_bucket)
            except Exception as e:
                print(f"Supabase upload failed: {e}")
                # We'll continue even if Supabase upload fails, or we could raise an error

        # Upload to Gemini File API
        if client:
            gemini_file = client.files.upload(
                file=temp_file_path, config={"display_name": file.filename}
            )
            gemini_file_id = gemini_file.name
            gemini_file_uri = gemini_file.uri
            status = normalize_file_status(getattr(gemini_file, "state", None))
        else:
            # For testing or if client not configured
            gemini_file_id = f"mock_file_{file_id}"
            gemini_file_uri = f"mock://{gemini_file_id}"
            # Mock files are immediately available in local/dev test mode.
            status = "ACTIVE"

        # Create document record in database
        db_document = Document(
            filename=file.filename,
            gemini_file_id=gemini_file_id,
            gemini_file_uri=gemini_file_uri,
            supabase_file_url=supabase_file_url,
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
    documents = db.query(Document).order_by(Document.created_at.desc()).all()
    refresh_document_statuses(db, documents, client)
    return documents


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
            # If deletion from Gemini fails, continue to remove the DB record
            pass

    # Attempt to delete from Supabase Storage
    if supabase and doc.supabase_file_url:
        try:
            # Extract file path from URL
            # Example URL: https://[project].supabase.co/storage/v1/object/public/documents/uuid_filename.pdf
            url_parts = doc.supabase_file_url.split("/public/documents/")
            if len(url_parts) == 2:
                file_path_in_bucket = url_parts[1]
                supabase.storage.from_("documents").remove([file_path_in_bucket])
        except Exception as e:
            print(f"Supabase delete failed: {e}")
            pass

    db.delete(doc)
    db.commit()
