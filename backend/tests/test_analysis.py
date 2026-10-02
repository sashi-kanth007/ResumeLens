import io

from tests.conftest import make_pdf


def upload(client, content: bytes, *, filename="resume.pdf", content_type="application/pdf", job="Python developer"):
    return client.post(
        "/api/analysis/",
        data={"job_description": job},
        files={"resume": (filename, io.BytesIO(content), content_type)},
    )


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_get_history_empty(client):
    response = client.get("/api/analysis/history")
    assert response.status_code == 200
    assert response.json() == []


def test_get_analysis_not_found(client):
    assert client.get("/api/analysis/999").status_code == 404


def test_create_and_fetch_analysis(client, pdf_bytes):
    created = upload(client, pdf_bytes)
    assert created.status_code == 201
    body = created.json()
    assert body["resume_filename"] == "resume.pdf"
    assert set(body["result"]) == {
        "overall_score", "semantic_score", "skill_score",
        "matched_skills", "missing_skills", "recommendations",
    }

    fetched = client.get(f"/api/analysis/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["result"] == body["result"]

    history = client.get("/api/analysis/history").json()
    assert [item["id"] for item in history] == [body["id"]]


def test_history_is_newest_first(client, pdf_bytes):
    first = upload(client, pdf_bytes).json()["id"]
    second = upload(client, pdf_bytes).json()["id"]
    history = client.get("/api/analysis/history").json()
    assert [item["id"] for item in history] == [second, first]


def test_delete_analysis(client, pdf_bytes):
    analysis_id = upload(client, pdf_bytes).json()["id"]
    assert client.delete(f"/api/analysis/{analysis_id}").status_code == 204
    assert client.get(f"/api/analysis/{analysis_id}").status_code == 404


def test_accepts_pdf_sent_as_octet_stream(client, pdf_bytes):
    assert upload(client, pdf_bytes, content_type="application/octet-stream").status_code == 201


def test_rejects_non_pdf_file(client):
    response = upload(client, b"plain text", filename="resume.txt", content_type="text/plain")
    assert response.status_code == 400


def test_rejects_corrupt_pdf(client):
    assert upload(client, b"not really a pdf").status_code == 422


def test_rejects_pdf_without_text(client):
    assert upload(client, make_pdf("")).status_code == 422


def test_rejects_blank_job_description(client, pdf_bytes):
    assert upload(client, pdf_bytes, job="   ").status_code == 422


def test_rejects_oversized_file(client, monkeypatch):
    monkeypatch.setattr("app.routers.analysis.MAX_UPLOAD_BYTES", 10)
    assert upload(client, b"%PDF-" + b"0" * 100).status_code == 413
