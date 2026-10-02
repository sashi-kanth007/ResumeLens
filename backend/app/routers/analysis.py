import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from app.config import settings
from app.database import get_session
from app.models.analysis import AnalysisRecord
from app.schemas.analysis import AnalysisHistoryItem, AnalysisResponse, AnalysisResult
from app.services.analyzer import analyze
from app.services.pdf_extractor import PDFExtractionError, extract_text_from_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

MAX_UPLOAD_BYTES = settings.max_upload_mb * 1024 * 1024


def _to_response(record: AnalysisRecord) -> AnalysisResponse:
    return AnalysisResponse(
        id=record.id,
        created_at=record.created_at,
        resume_filename=record.resume_filename,
        result=AnalysisResult.model_validate(record, from_attributes=True),
    )


def _read_pdf_upload(resume: UploadFile) -> bytes:
    filename = (resume.filename or "").lower()
    if resume.content_type != "application/pdf" and not filename.endswith(".pdf"):
        logger.warning("Rejected upload %r: not a PDF (content type %s)", resume.filename, resume.content_type)
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    data = resume.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        logger.warning("Rejected upload %r: larger than %d MB", resume.filename, settings.max_upload_mb)
        raise HTTPException(status_code=413, detail=f"File is larger than {settings.max_upload_mb} MB.")
    return data


# Plain `def` so FastAPI runs this in a worker thread: PDF parsing and ML scoring
# are blocking and would otherwise freeze the event loop.
@router.post("/", response_model=AnalysisResponse, status_code=201)
def create_analysis(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
    session: Session = Depends(get_session),
):
    job_description = job_description.strip()
    if not job_description:
        logger.warning("Rejected analysis of %r: empty job description", resume.filename)
        raise HTTPException(status_code=422, detail="Job description must not be empty.")

    try:
        resume_text = extract_text_from_pdf(_read_pdf_upload(resume))
    except PDFExtractionError as exc:
        logger.warning("Could not extract text from %r: %s", resume.filename, exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = analyze(resume_text, job_description)
    record = AnalysisRecord(
        resume_filename=resume.filename or "unnamed.pdf",
        job_description=job_description,
        **result.model_dump(),
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    logger.info(
        "Saved analysis #%d for %r: overall=%.1f semantic=%.1f skills=%.1f (matched %d, missing %d)",
        record.id, record.resume_filename, result.overall_score, result.semantic_score,
        result.skill_score, len(result.matched_skills), len(result.missing_skills),
    )
    return _to_response(record)


@router.get("/history", response_model=list[AnalysisHistoryItem])
def get_history(limit: int = 50, session: Session = Depends(get_session)):
    limit = max(1, min(limit, 200))
    statement = select(AnalysisRecord).order_by(AnalysisRecord.created_at.desc()).limit(limit)
    return [AnalysisHistoryItem.model_validate(r, from_attributes=True) for r in session.exec(statement)]


@router.get("/{analysis_id}", response_model=AnalysisResponse)
def get_analysis(analysis_id: int, session: Session = Depends(get_session)):
    record = session.get(AnalysisRecord, analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return _to_response(record)


@router.delete("/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: int, session: Session = Depends(get_session)):
    record = session.get(AnalysisRecord, analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    session.delete(record)
    session.commit()
    logger.info("Deleted analysis #%d", analysis_id)
