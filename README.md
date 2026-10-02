# ResumeLens

ResumeLens compares a **resume (PDF)** with a **job description** and tells you how well they match.
You upload a resume, paste a job posting, and get back:

- an **overall match score** (0–100), with the semantic and skill scores behind it;
- the skills the job asks for that the resume **has** and the ones it is **missing**;
- **recommendations** for improving the resume for that job;
- a **history** of past analyses you can reopen or delete.

The project has two parts:

| Folder | What it is | Built with |
|---|---|---|
| [`App/`](App) | Mobile app for Android, iOS and web | Expo SDK 57, Expo Router, React Native, TypeScript |
| [`backend/`](backend) | REST API that does the analysis and stores results | FastAPI, SQLModel + SQLite, PyMuPDF, sentence-transformers |

---

## Contents

1. [How it works](#how-it-works)
2. [Features](#features)
3. [Repository layout](#repository-layout)
4. [Prerequisites](#prerequisites)
5. [Quick start](#quick-start)
6. [Connecting the app to the backend](#connecting-the-app-to-the-backend)
7. [Configuration](#configuration)
8. [API overview](#api-overview)
9. [Tests and checks](#tests-and-checks)
10. [Troubleshooting](#troubleshooting)
11. [Known limitations](#known-limitations)

---

## How it works

```
┌──────────────────┐   PDF + job description    ┌──────────────────────────────────┐
│   Mobile app     │ ─────────────────────────► │         FastAPI backend          │
│ (Expo / React    │                            │                                  │
│     Native)      │ ◄───────────────────────── │  1. PDF → text (PyMuPDF)         │
└──────────────────┘     scores, skills,        │  2. Score the match              │
                         recommendations        │  3. Save the result (SQLite)     │
                                                └──────────────────────────────────┘
```

The backend produces three scores, each from 0 to 100:

| Score | Question it answers | How |
|---|---|---|
| **Semantic** | Do the two texts talk about the same things? | Both texts are embedded with the `all-MiniLM-L6-v2` model and compared by cosine similarity. |
| **Skill** | Does the resume have the skills the job asks for? | Both texts are searched for about 100 known skills; the score is matched ÷ required. |
| **Overall** | How good is the match? | `0.5 × semantic + 0.5 × skill` |

Only the result, the file name and the job description are saved. The PDF and the resume text are not stored.

The full scoring rules, with a worked example, are in the [backend README](backend/README.md#4-how-the-scores-are-calculated).

---

## Features

**Mobile app**

- Four tabs: **Home**, **Analyze**, **History** and **Settings**, plus a result screen for each analysis.
- Pick a PDF resume from the device and paste a job description to analyze it.
- Light and dark themes.
- **Demo mode**: with no API URL set, the app runs on built-in sample data, so every screen works without the backend.

**Backend**

- Endpoints to create, list, fetch and delete analyses, with interactive docs at `/docs`.
- Upload validation: PDF only, 5 MB by default, clear error messages for corrupt or image-only PDFs.
- Request logging to the console and a rotating log file.
- Automated tests that run in under a second, using an in-memory database and a fake model.

---

## Repository layout

```
ResumeLens/
├── App/                      # Mobile app (Expo)
│   ├── src/
│   │   ├── app/              # Screens (Expo Router): (tabs)/ and analysis/[id]
│   │   ├── components/       # UI building blocks and analysis components
│   │   ├── services/         # API client and analysis service
│   │   ├── mocks/            # Demo data used when no API URL is set
│   │   ├── config/           # EXPO_PUBLIC_* settings
│   │   └── hooks/, types/, utils/, constants/
│   ├── .env.example
│   └── package.json
├── backend/                  # REST API (FastAPI)
│   ├── app/
│   │   ├── main.py           # App setup, CORS, startup, /health
│   │   ├── routers/          # /api/analysis endpoints
│   │   ├── services/         # PDF extraction, scoring, skill list
│   │   ├── models/           # Database table
│   │   └── schemas/          # API response shapes
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
└── README.md
```

Each part has its own README with more detail: [App/README.md](App/README.md) and [backend/README.md](backend/README.md).

---

## Prerequisites

| Tool | Needed for | Notes |
|---|---|---|
| **Git** | Cloning the repository | |
| **Python 3.10+** | Backend | |
| **Node.js (LTS) and npm** | Mobile app | |
| **Expo Go** on a phone, or an Android emulator / iOS simulator | Running the app | Or press `w` to run it in a browser |
| Internet access | First run | To install packages and download the AI model (about 90 MB) |

---

## Quick start

### 1. Clone the repository

```bash
git clone https://github.com/sashi-kanth007/ResumeLens.git
cd ResumeLens
```

### 2. Start the backend

The commands are for Windows PowerShell; macOS/Linux equivalents are in the comments.

```powershell
cd backend

# Create and activate a virtual environment   (macOS/Linux: source venv/bin/activate)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install dependencies (runtime + tests)
pip install -r requirements-dev.txt

# Optional: create your config file           (macOS/Linux: cp .env.example .env)
copy .env.example .env

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0
```

Wait for **`Application startup complete.`** The first start downloads the model, so it takes longer.

- API: http://127.0.0.1:8000
- Interactive docs: http://127.0.0.1:8000/docs

`--host 0.0.0.0` makes the server reachable from a phone on the same Wi-Fi. Without it, only the computer itself can connect.

### 3. Start the mobile app

Open a second terminal:

```bash
cd App
npm install
npx expo start
```

Then press `a` (Android), `i` (iOS) or `w` (web), or scan the QR code with Expo Go.

At this point the app runs on **demo data**. To use the real backend, follow the next section.

---

## Connecting the app to the backend

1. In `App/`, copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_API_URL` to the address the app should use to reach the backend:

   | Where the app runs | Value |
   |---|---|
   | Physical phone | `http://<your computer's LAN IP>:8000`, for example `http://192.168.1.10:8000` |
   | Android emulator | `http://10.0.2.2:8000` |
   | iOS simulator or web | `http://localhost:8000` |

3. If you run the app **on web**, add `http://localhost:8081` to `CORS_ORIGINS` in `backend/.env` and restart the backend.
4. Restart the Expo dev server so it picks up the new values: `npx expo start --clear`.

The phone and the computer must be on the same network, and the backend must be running with `--host 0.0.0.0`.

---

## Configuration

Both parts read settings from a `.env` file in their own folder. The `.env` files are not committed; the `.env.example` files are the templates.

### App (`App/.env`)

| Variable | Example | Meaning |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://192.168.1.10:8000` | Backend address. Leave empty to run on demo data. |
| `EXPO_PUBLIC_USE_MOCKS` | `false` | Set to `true` to force demo data even when an API URL is set. |
| `EXPO_PUBLIC_USE_RN_FETCH` | `true` | Use React Native's `fetch`, which resume uploads need. |

### Backend (`backend/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `APP_NAME` | `ResumeLens` | Name shown in `/health` and the API docs |
| `DATABASE_URL` | `sqlite:///./resumelens.db` | Database location |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated web origins allowed to call the API |
| `MAX_UPLOAD_MB` | `5` | Largest resume accepted, in MB |
| `EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Model used for the semantic score |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR` |
| `LOG_FILE` | `logs/app.log` | Rotating log file; leave empty to log to the console only |

Restart the server or the Expo dev server after changing a `.env` file.

---

## API overview

Base URL: `http://127.0.0.1:8000`

| Method | Path | What it does |
|---|---|---|
| GET | `/health` | Checks that the server is up |
| POST | `/api/analysis/` | Analyzes a resume against a job description and saves the result |
| GET | `/api/analysis/history?limit=50` | Lists past analyses, newest first |
| GET | `/api/analysis/{id}` | Gets one analysis in full |
| DELETE | `/api/analysis/{id}` | Deletes one analysis |

`POST /api/analysis/` takes `multipart/form-data` with two fields: `resume` (a PDF file) and `job_description` (text). Example response:

```json
{
  "id": 1,
  "created_at": "2026-09-26T10:15:00Z",
  "resume_filename": "resume.pdf",
  "result": {
    "overall_score": 72.1,
    "semantic_score": 80.6,
    "skill_score": 63.6,
    "matched_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
    "missing_skills": ["Django", "Kubernetes", "Redis", "Terraform"],
    "recommendations": [
      "The job asks for Django. If you have experience with it, add it to your resume with a concrete example; if not, consider learning it."
    ]
  }
}
```

Request and error details are in the [backend README](backend/README.md#5-api-reference).

---

## Tests and checks

**Backend** (from `backend/`, with the virtual environment active):

```powershell
python -m pytest -q
```

**App** (from `App/`):

```bash
npx tsc --noEmit    # typecheck
npx expo lint       # lint
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| The app shows sample data instead of your analyses | `EXPO_PUBLIC_API_URL` is empty or `EXPO_PUBLIC_USE_MOCKS` is `true`. Fix `App/.env` and restart with `npx expo start --clear`. |
| The app on a phone cannot reach the backend | Use the computer's LAN IP rather than `localhost`, start the backend with `--host 0.0.0.0`, keep both devices on the same Wi-Fi, and allow port 8000 through the firewall. |
| CORS error when running the app on web | Add `http://localhost:8081` to `CORS_ORIGINS` in `backend/.env` and restart the backend. |
| `ModuleNotFoundError` in the backend | Activate the virtual environment and run `pip install -r requirements-dev.txt`. |
| Port 8000 is already in use | Stop the other server, or run on another port with `--port 8001` and update `EXPO_PUBLIC_API_URL`. |
| The first backend start is slow or fails offline | The model is downloaded on the first start. Connect to the internet once; after that it loads from the cache. |
| `422 No text found in the PDF` | The PDF is a scanned image. Export the resume as a text PDF from Word or Google Docs. |

More backend-specific fixes are in the [backend README](backend/README.md#10-troubleshooting).

---

## Known limitations

- Only skills in the backend's skill list are detected. Add more in `backend/app/services/skills.py`.
- "Either/or" requirements count as all required: "FastAPI or Django" makes Django a missing skill even if the resume has FastAPI.
- Scanned PDFs are not supported, because there is no OCR.
- Strong matches usually score around 60–85 on the semantic score rather than near 100.
- There are no user accounts: everyone using the same backend shares one history.
