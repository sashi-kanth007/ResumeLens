import os

# Must be set before the app is imported so tests never touch the real database file.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["LOG_FILE"] = ""

import zlib

import numpy as np
import pymupdf
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

from app.database import engine
from app.main import app


class FakeEmbeddingModel:
    """Bag-of-words stand-in for the sentence-transformers model, so tests never download it."""

    def encode(self, texts, normalize_embeddings=False):
        vectors = np.zeros((len(texts), 256))
        for row, text in enumerate(texts):
            for word in text.lower().split():
                vectors[row, zlib.crc32(word.encode()) % 256] += 1
        if normalize_embeddings:
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            vectors = np.divide(vectors, norms, out=vectors, where=norms > 0)
        return vectors


@pytest.fixture(autouse=True)
def fake_model(monkeypatch):
    monkeypatch.setattr("app.services.analyzer.get_model", lambda: FakeEmbeddingModel())


@pytest.fixture
def client():
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as client:
        yield client


def make_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    if text:
        page.insert_text((72, 72), text)
    return doc.tobytes()


@pytest.fixture
def pdf_bytes() -> bytes:
    return make_pdf("Jane Doe - Python, FastAPI, SQL developer")
