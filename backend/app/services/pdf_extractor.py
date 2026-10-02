import pymupdf


class PDFExtractionError(ValueError):
    pass


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        with pymupdf.open(stream=file_bytes, filetype="pdf") as doc:
            text = "\n".join(page.get_text() for page in doc).strip()
    except Exception as exc:  # PyMuPDF raises several error types for bad input
        raise PDFExtractionError("The file is not a valid PDF.") from exc

    if not text:
        raise PDFExtractionError("No text found in the PDF. Scanned/image-only resumes are not supported.")
    return text
