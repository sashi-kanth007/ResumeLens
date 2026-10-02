# ResumeLens — Backend

ResumeLens compares a **resume (PDF)** with a **job description** and tells you how well they match.
It returns three scores, the skills the resume has and lacks, and suggestions for improving it.

This folder is the backend: a REST API built with **FastAPI**. It reads the PDF, runs the analysis with a
small AI model, saves the result to a **SQLite** database, and returns it as JSON. The mobile app in
`../App` is a separate app that calls this API.

---

## Contents

1. [How it works (big picture)](#1-how-it-works-big-picture)
2. [Project structure](#2-project-structure)
3. [What happens during one request](#3-what-happens-during-one-request)
4. [How the scores are calculated](#4-how-the-scores-are-calculated)
5. [API reference](#5-api-reference)
6. [Setup](#6-setup)
7. [Running the server](#7-running-the-server)
8. [Testing](#8-testing)
9. [Configuration](#9-configuration)
10. [Troubleshooting](#10-troubleshooting)
11. [Known limitations](#11-known-limitations)

---

## 1. How it works (big picture)

```
 ┌──────────────┐   PDF + job description    ┌───────────────────────────────────────────────┐
 │  Mobile app  │ ─────────────────────────► │             FastAPI backend                    │
 │    (Expo)    │ ◄───────────────────────── │                                               │
 └──────────────┘        JSON result         │  routers/analysis.py   ← HTTP endpoints        │
   or Swagger UI                             │        │                                      │
   at /docs                                  │        ├─► services/pdf_extractor.py           │
                                             │        │      PDF bytes → plain text (PyMuPDF) │
                                             │        │                                      │
                                             │        ├─► services/analyzer.py                │
                                             │        │      text → scores, skills, advice    │
                                             │        │      uses: sentence-transformers      │
                                             │        │            services/skills.py         │
                                             │        │                                      │
                                             │        └─► database.py + models/analysis.py    │
                                             │               save / read results (SQLModel)  │
                                             └───────────────────────┬───────────────────────┘
                                                                     │
                                                           resumelens.db (SQLite)
```

The code is split into **layers**, each with one job:

| Layer | Folder / file | Responsibility |
|---|---|---|
| **App entry point** | `app/main.py` | Creates the FastAPI app, enables CORS for the frontend, registers routes, and on startup creates the database tables and loads the AI model. |
| **Routes (HTTP layer)** | `app/routers/analysis.py` | Receives requests, validates the upload, calls the services, saves the result, and returns JSON. Contains no analysis logic. |
| **Services (business logic)** | `app/services/` | `pdf_extractor.py` turns a PDF into text. `analyzer.py` does the scoring. `skills.py` is the list of skills it knows about. |
| **Schemas (API shapes)** | `app/schemas/analysis.py` | Pydantic models that define exactly what the API returns. |
| **Models (database tables)** | `app/models/analysis.py` | The `AnalysisRecord` table that stores every analysis. |
| **Database** | `app/database.py` | Creates the database connection and hands a session to each request. |
| **Config** | `app/config.py` | Reads settings from environment variables or a `.env` file. |

### Tech stack

| Purpose | Library |
|---|---|
| Web framework / API | FastAPI + Uvicorn |
| Data validation | Pydantic v2 |
| Database / ORM | SQLModel (SQLAlchemy) with SQLite |
| PDF text extraction | PyMuPDF |
| AI similarity model | sentence-transformers (`all-MiniLM-L6-v2`), running on PyTorch (CPU) |
| Maths | NumPy |
| Tests | pytest + httpx (FastAPI `TestClient`) |

---

## 2. Project structure

```
backend/
├── app/
│   ├── main.py               # App setup: CORS, routes, startup (DB tables + model load), /health
│   ├── config.py             # Settings from environment variables / .env
│   ├── database.py           # SQLite engine and per-request DB session
│   ├── models/
│   │   └── analysis.py       # AnalysisRecord — the database table
│   ├── schemas/
│   │   └── analysis.py       # AnalysisResult / AnalysisResponse / AnalysisHistoryItem — API output
│   ├── routers/
│   │   └── analysis.py       # /api/analysis endpoints (create, history, get, delete)
│   └── services/
│       ├── pdf_extractor.py  # PDF bytes → text
│       ├── analyzer.py       # Scoring: semantic similarity + skill matching + recommendations
│       └── skills.py         # The skill vocabulary (names and alternate spellings)
├── tests/
│   ├── conftest.py           # Test setup: in-memory DB, fake AI model, PDF helper
│   ├── test_analysis.py      # API tests (endpoints, validation, errors)
│   └── test_analyzer.py      # Unit tests for skill detection and scoring
├── requirements.txt          # Runtime dependencies
├── requirements-dev.txt      # Runtime + test dependencies
├── pytest.ini                # pytest settings
├── .env.example              # Template for your .env file
└── resumelens.db             # Created automatically on first run (not committed)
```

---

## 3. What happens during one request

This is the path of `POST /api/analysis/` from upload to response:

1. **Upload arrives.** The client sends a multipart form with `resume` (the PDF) and `job_description` (text).
2. **Validate the job description.** Surrounding spaces are removed; an empty value is rejected with **422**.
3. **Validate the file** (`_read_pdf_upload` in the router):
   - it must be a PDF (content type `application/pdf` *or* a `.pdf` file name), otherwise **400**;
   - it must not exceed `MAX_UPLOAD_MB` (default 5 MB), otherwise **413**.
4. **Extract the text** (`pdf_extractor.extract_text_from_pdf`). PyMuPDF reads every page. A broken PDF, or one
   with no text (for example a scanned image), is rejected with **422**.
5. **Analyse** (`analyzer.analyze`) — see [section 4](#4-how-the-scores-are-calculated).
6. **Save.** The result, the file name, and the job description go into the `analysisrecord` table.
   The PDF itself and the resume text are **not** stored.
7. **Respond** with **201** and the saved analysis as JSON.

Two design choices worth knowing:

- **The AI model loads once, at startup** (`analyzer.load_model()` in `main.py`). Loading takes several seconds, so
  doing it per request would make every request slow. The first run downloads the model (~90 MB) from Hugging Face
  and caches it in `~/.cache/huggingface`.
- **The endpoint is a plain `def`, not `async def`.** PDF parsing and the model are slow, blocking work. FastAPI runs
  plain `def` endpoints in a worker thread, so one analysis doesn't freeze the server for everyone else.

---

## 4. How the scores are calculated

All scores are on a **0–100** scale. The logic is in `app/services/analyzer.py`.

### 4.1 Semantic score — "do these texts talk about the same things?"

1. The resume and the job description are each turned into an **embedding**: a list of 384 numbers that captures
   the *meaning* of the text, produced by the `all-MiniLM-L6-v2` model.
2. That model only reads about 180 words at a time, so each text is split into 150-word **chunks**. Every chunk is
   embedded, and the chunk embeddings are averaged into one embedding for the whole text.
3. The two embeddings are compared with **cosine similarity** (1 = same meaning, 0 = unrelated).
   Negative values are treated as 0, and the result is multiplied by 100.

Because this compares meaning rather than exact words, "built web services" and "developed APIs" count as similar.

> In practice a strong match scores roughly **60–85**, not 100 — two different documents are never identical in meaning.

### 4.2 Skill score — "does the resume have the skills the job asks for?"

1. `app/services/skills.py` holds a list of about 100 skills, each with its alternate spellings
   (for example `Kubernetes` ← `kubernetes`, `k8s`; `scikit-learn` ← `sklearn`).
2. Both texts are searched for these skills (`extract_skills`). The search is careful about word boundaries:
   - `SQL` is not found inside `PostgreSQL` or `NoSQL`, and `Java` is not found inside `JavaScript`;
   - symbols work: `C++`, `C#`, `.NET`, `Node.js`;
   - skills that are also ordinary English words (`Go`, `Swift`, `Spark`, `Excel`, `Express`) only count when
     **capitalised**, so "ready to go" doesn't match Go.
3. **Matched skills** = skills in the job description that also appear in the resume.
   **Missing skills** = skills in the job description that don't.
4. `skill_score = matched / skills in job description × 100`.

### 4.3 Overall score

```
overall_score = 0.5 × semantic_score + 0.5 × skill_score
```

If the job description mentions **no known skills** (for example a non-technical job), the skill score is reported
as 0 and the overall score is just the semantic score.

The weights are the constants `SEMANTIC_WEIGHT` and `SKILL_WEIGHT` at the top of `analyzer.py`.

### 4.4 Recommendations

- One suggestion per missing skill, for the first 5, in the order the job description mentions them.
  If more are missing, one extra line says how many.
- If nothing is missing: "Your resume mentions every skill the job description asks for."
- If the semantic score is below 40: a tip to describe your experience using the job description's wording.
- If no skills were recognised in the job description: a note that the score is based on similarity alone.

### 4.5 Worked example

A backend-engineer resume (Python, FastAPI, PostgreSQL, Docker, AWS, CI/CD) against two jobs:

| Job | Overall | Semantic | Skill | Missing skills |
|---|---|---|---|---|
| Backend engineer (Python, FastAPI or Django, PostgreSQL, Docker, Kubernetes, Redis, AWS, CI/CD, Terraform) | 72.1 | 80.6 | 63.6 | Django, Kubernetes, Redis, Terraform |
| Pastry chef | 7.3 | 7.3 | 0 (no skills in job) | — |

### 4.6 Adding a skill

Add a line to `SKILLS` in `app/services/skills.py`:

```python
"Svelte": ["svelte", "sveltekit"],   # display name: [lowercase spellings]
```

If the name is also a common English word, put it in `CASE_SENSITIVE_SKILLS` instead so only the capitalised form
counts. No other code changes are needed.

---

## 5. API reference

Base URL: `http://127.0.0.1:8000`. Interactive docs: **`/docs`** (Swagger UI) or `/redoc`.

| Method | Path | What it does | Success |
|---|---|---|---|
| GET | `/health` | Checks that the server is up | 200 |
| POST | `/api/analysis/` | Analyses a resume against a job description and saves the result | 201 |
| GET | `/api/analysis/history?limit=50` | Lists past analyses, newest first (`limit` is 1–200) | 200 |
| GET | `/api/analysis/{id}` | Gets one analysis in full | 200 |
| DELETE | `/api/analysis/{id}` | Deletes one analysis | 204 |

### POST /api/analysis/

**Request** — `multipart/form-data`:

| Field | Type | Rules |
|---|---|---|
| `resume` | file | PDF with selectable text, at most 5 MB |
| `job_description` | text | Must not be blank |

**Response** — `201 Created`:

```json
{
  "id": 1,
  "created_at": "2026-09-26T10:15:00Z",
  "resume_filename": "resume.pdf",
  "result": {
    "overall_score": 72.1,
    "semantic_score": 80.6,
    "skill_score": 63.6,
    "matched_skills": ["REST APIs", "Python", "FastAPI", "PostgreSQL", "Docker", "AWS", "CI/CD"],
    "missing_skills": ["Django", "Kubernetes", "Redis", "Terraform"],
    "recommendations": [
      "The job asks for Django. If you have experience with it, add it to your resume with a concrete example; if not, consider learning it."
    ]
  }
}
```

`GET /api/analysis/history` returns a shorter item per analysis: `id`, `created_at`, `resume_filename`, `overall_score`.
Times are always in UTC.

### Errors

Every error returns JSON like `{"detail": "message"}`.

| Code | When |
|---|---|
| 400 | The file is not a PDF |
| 404 | No analysis with that id |
| 413 | The file is larger than `MAX_UPLOAD_MB` |
| 422 | Blank job description, a missing field, a corrupt PDF, or a PDF with no text |

---

## 6. Setup

**Requirements:** Python 3.10 or newer, and internet access the first time (to install packages and download the model).

Run these from the `backend` folder. The commands are for Windows PowerShell; macOS/Linux equivalents are in the comments.

```powershell
# 1. Create a virtual environment
python -m venv venv

# 2. Activate it                (macOS/Linux: source venv/bin/activate)
.\venv\Scripts\Activate.ps1

# 3. Install dependencies (runtime + tests)
pip install -r requirements-dev.txt

# 4. Create your config file     (macOS/Linux: cp .env.example .env)
copy .env.example .env
```

Step 4 is optional: every setting has a sensible default.

> If PowerShell refuses to run `Activate.ps1`, run
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or skip activation and call
> `.\venv\Scripts\python.exe` directly instead of `python`.

---

## 7. Running the server

```powershell
uvicorn app.main:app --reload --host 0.0.0.0
```

- `--host 0.0.0.0` makes the server reachable from other devices on your Wi-Fi (e.g. the mobile app on your phone). Without it, uvicorn only listens on `127.0.0.1` and the app cannot connect.
- `--reload` restarts the server automatically when you save a code file (for development only).
- Wait for **`Application startup complete.`** The first start downloads the model, so it takes longer.
- The API is now at **http://127.0.0.1:8000** and the interactive docs at **http://127.0.0.1:8000/docs**.
- Stop the server with **Ctrl+C**.

The database file `resumelens.db` is created automatically. To start with an empty history, stop the server,
delete the file, and start again.

The mobile app (`../App`, `npm install` then `npx expo start`) connects through `EXPO_PUBLIC_API_URL` in its `.env`.
Native builds need no CORS setup; to run the app on web, add `http://localhost:8081` to `CORS_ORIGINS`.

---

## 8. Testing

### 8.1 Automated tests

```powershell
python -m pytest -q
```

All tests should pass. They:

- use an **in-memory database**, so your real `resumelens.db` is never touched;
- replace the AI model with a small **fake model** (`FakeEmbeddingModel` in `tests/conftest.py`), so they run in
  under a second and never download anything.

| File | What it covers |
|---|---|
| `tests/test_analysis.py` | Every endpoint, plus the error cases (wrong file type, corrupt/empty PDF, blank job description, oversized file, 404) |
| `tests/test_analyzer.py` | Skill detection (word boundaries, symbols, aliases, capitalised-only skills), score maths, and recommendations |

### 8.2 Manual testing in the browser (Swagger UI)

With the server running, open **http://127.0.0.1:8000/docs**. For each endpoint: click it to expand, click
**Try it out**, fill in the fields, click **Execute**, and read the **Responses** section.

1. **Health** — `GET /health` → `200`, `{"status": "ok", "app": "ResumeLens"}`.
2. **Analyse** — `POST /api/analysis/`:
   choose a PDF resume in **resume**, paste a job posting in **job_description**, and execute.
   Expect `201` with the scores, skills, and recommendations. **Note the `id`.**
3. **History** — `GET /api/analysis/history` → `200`; your analysis is at the top.
4. **Fetch one** — `GET /api/analysis/{analysis_id}` with your `id` → `200`, same result as step 2.
   Try `9999` → `404`.
5. **Delete** — `DELETE /api/analysis/{analysis_id}` with your `id` → `204`. Fetching it again → `404`.
6. **Error cases** (all in `POST /api/analysis/`):

   | Do this | Expected |
   |---|---|
   | Upload a `.txt`, `.docx`, or image | `400` "Only PDF files are accepted." |
   | Job description of only spaces | `422` "Job description must not be empty." |
   | Scanned / image-only PDF | `422` "No text found in the PDF..." |
   | PDF larger than 5 MB | `413` |
   | Leave a field empty | `422` |

7. **Check the scores make sense** — analyse the *same* resume against:
   - a job in your field → semantic score roughly 60–85, sensible matched skills;
   - an unrelated job (e.g. "Pastry chef to bake cakes and breads") → low scores and a
     "content is quite different" recommendation;
   - a job listing skills you don't have (e.g. "Rust, Kafka, Terraform") → they appear in `missing_skills`.

### 8.3 Manual testing from the command line

Use `curl.exe` (in Windows PowerShell 5.1, plain `curl` is an alias for a different command):

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/analysis/ `
  -F "resume=@C:\path\to\resume.pdf;type=application/pdf" `
  -F "job_description=Backend engineer with Python, FastAPI, PostgreSQL and Docker"

curl.exe http://127.0.0.1:8000/api/analysis/history
curl.exe http://127.0.0.1:8000/api/analysis/1
curl.exe -X DELETE -i http://127.0.0.1:8000/api/analysis/1
```

---

## 9. Configuration

Settings are read from environment variables, or from a `.env` file in the `backend` folder (see `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `APP_NAME` | `ResumeLens` | Name shown in `/health` and the API docs |
| `DATABASE_URL` | `sqlite:///./resumelens.db` | Database location (any SQLAlchemy URL) |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated frontend URLs allowed to call the API |
| `MAX_UPLOAD_MB` | `5` | Largest resume accepted, in MB |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | sentence-transformers model used for the semantic score |

Restart the server after changing `.env`.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError` | The virtual environment isn't active or dependencies are missing: activate it and run `pip install -r requirements-dev.txt`. |
| `address already in use` / port 8000 busy | Another server is running. Stop it, or use another port: `uvicorn app.main:app --reload --port 8001`. |
| First start is slow or fails offline | The model is downloaded on the first start. Connect to the internet once; after that it loads from the cache. |
| Warnings about `HF_TOKEN` or symlinks at startup | Harmless. They come from the Hugging Face download library. |
| Frontend gets a CORS error | Add the frontend's URL to `CORS_ORIGINS` in `.env` and restart. |
| `422 No text found in the PDF` | The PDF is a scanned image. Export the resume as a text PDF (from Word or Google Docs). |
| Old analyses show all-zero scores | They were created before the analyzer was implemented. Delete them, or delete `resumelens.db`. |

---

## 11. Known limitations

- **Skills outside the list aren't detected.** Only skills in `skills.py` count; add any your users need.
- **"Either/or" requirements count as all required.** "FastAPI or Django" makes Django a missing skill even if the
  resume has FastAPI.
- **Skills are only detected by name.** A resume that describes container orchestration without writing
  "Kubernetes" won't match that skill (the semantic score still gives some credit).
- **Scanned PDFs aren't supported.** There is no OCR.
- **Semantic scores are not rescaled.** Strong matches usually land around 60–85 rather than near 100.
- **SQLite is for one server.** For production with several servers, point `DATABASE_URL` at PostgreSQL (and install a driver such as `psycopg`).
  Changes to the table structure need a migration tool (such as Alembic), because `create_all` only creates
  missing tables and never alters existing ones.
