from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.db import get_db
from app.models.document import Document
from app.schemas.document import DocumentResponse
from app.core.config import settings
from app.services.gemini_documents import (
    normalize_file_status,
    refresh_document_statuses,
)
import uuid
import os
from google import genai

router = APIRouter()

try:
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception:
    client = None


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

    # Save file temporarily to upload to Gemini
    temp_file_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
    try:
        with open(temp_file_path, "wb") as f:
            f.write(await file.read())

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
            gemini_file_id = f"mock_file_{uuid.uuid4()}"
            gemini_file_uri = f"mock://{gemini_file_id}"
            # Mock files are immediately available in local/dev test mode.
            status = "ACTIVE"

        # Create document record in database
        db_document = Document(
            filename=file.filename,
            gemini_file_id=gemini_file_id,
            gemini_file_uri=gemini_file_uri,
            mime_type=file.content_type,
            status=status,
        )
        db.add(db_document)
        db.commit()
        db.refresh(db_document)
        return db_document

    except Exception as e:
        db.rollback()
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
    """Delete a document by ID. Also removes it from the Gemini File API if possible."""
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

    db.delete(doc)
    db.commit()
