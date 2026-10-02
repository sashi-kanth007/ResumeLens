import logging
import re
import time
from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import settings
from app.schemas.analysis import AnalysisResult
from app.services.skills import CASE_SENSITIVE_SKILLS, SKILLS

logger = logging.getLogger(__name__)

SEMANTIC_WEIGHT = 0.5
SKILL_WEIGHT = 0.5

# all-MiniLM-L6-v2 truncates input at 256 word pieces (~180 words), so longer
# texts are embedded in chunks and the chunk embeddings averaged.
CHUNK_WORDS = 150

MAX_SKILL_RECOMMENDATIONS = 5
LOW_SEMANTIC_SCORE = 40.0


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    logger.info("Loading embedding model %s", settings.embedding_model)
    start = time.perf_counter()
    model = SentenceTransformer(settings.embedding_model)
    logger.info("Embedding model loaded in %.1f s", time.perf_counter() - start)
    return model


def load_model() -> None:
    """Load the embedding model up front so the first request isn't slow."""
    get_model()


def _skill_pattern(aliases: list[str], flags: int = 0) -> re.Pattern:
    # Custom boundaries instead of \b so "c++", "c#" and ".net" match, "js" doesn't match
    # inside "node.js", and a trailing full stop ("...in Python.") still counts.
    alternation = "|".join(re.escape(alias) for alias in sorted(aliases, key=len, reverse=True))
    return re.compile(rf"(?<![\w+#.])(?:{alternation})(?![\w+#]|\.\w)", flags)


def _build_skill_patterns() -> list[tuple[str, list[re.Pattern]]]:
    patterns = []
    for skill in SKILLS.keys() | CASE_SENSITIVE_SKILLS.keys():
        skill_patterns = []
        if SKILLS.get(skill):
            skill_patterns.append(_skill_pattern(SKILLS[skill], re.IGNORECASE))
        if CASE_SENSITIVE_SKILLS.get(skill):
            skill_patterns.append(_skill_pattern(CASE_SENSITIVE_SKILLS[skill]))
        patterns.append((skill, skill_patterns))
    return patterns


_SKILL_PATTERNS = _build_skill_patterns()


def extract_skills(text: str) -> list[str]:
    """Return the known skills mentioned in `text`, in order of first mention."""
    positions = {}
    for skill, patterns in _SKILL_PATTERNS:
        starts = [m.start() for p in patterns if (m := p.search(text))]
        if starts:
            positions[skill] = min(starts)
    return sorted(positions, key=positions.get)


def _chunks(text: str) -> list[str]:
    words = text.split()
    return [" ".join(words[i:i + CHUNK_WORDS]) for i in range(0, len(words), CHUNK_WORDS)] or [""]


def _embed(text: str) -> np.ndarray:
    chunk_embeddings = get_model().encode(_chunks(text), normalize_embeddings=True)
    mean = np.mean(chunk_embeddings, axis=0)
    norm = np.linalg.norm(mean)
    return mean / norm if norm else mean


def semantic_similarity(resume_text: str, job_description: str) -> float:
    """Cosine similarity of the two texts' embeddings, as a 0-100 score."""
    similarity = float(np.dot(_embed(resume_text), _embed(job_description)))
    return round(max(0.0, min(similarity, 1.0)) * 100, 1)


def _recommendations(
    missing_skills: list[str], job_skills: list[str], semantic_score: float
) -> list[str]:
    recommendations = []
    if not job_skills:
        recommendations.append(
            "No specific technical skills were recognised in the job description, "
            "so the overall score is based on content similarity alone."
        )
    elif not missing_skills:
        recommendations.append("Your resume mentions every skill the job description asks for.")
    else:
        for skill in missing_skills[:MAX_SKILL_RECOMMENDATIONS]:
            recommendations.append(
                f"The job asks for {skill}. If you have experience with it, add it to your resume "
                "with a concrete example; if not, consider learning it."
            )
        remaining = len(missing_skills) - MAX_SKILL_RECOMMENDATIONS
        if remaining > 0:
            recommendations.append(
                f"{remaining} more required skill{'s' if remaining > 1 else ''} "
                "from the job description are also missing from your resume."
            )

    if semantic_score < LOW_SEMANTIC_SCORE:
        recommendations.append(
            "Your resume's content is quite different from the job description. Describe your "
            "relevant experience using the same terms the job description uses."
        )
    return recommendations


def analyze(resume_text: str, job_description: str) -> AnalysisResult:
    """Score a resume against a job description."""
    logger.debug(
        "Analyzing resume (%d words) against job description (%d words)",
        len(resume_text.split()), len(job_description.split()),
    )
    semantic_score = semantic_similarity(resume_text, job_description)

    job_skills = extract_skills(job_description)
    resume_skills = set(extract_skills(resume_text))
    matched_skills = [s for s in job_skills if s in resume_skills]
    missing_skills = [s for s in job_skills if s not in resume_skills]

    if job_skills:
        skill_score = round(len(matched_skills) / len(job_skills) * 100, 1)
        overall_score = round(SEMANTIC_WEIGHT * semantic_score + SKILL_WEIGHT * skill_score, 1)
    else:
        logger.info("No known skills found in job description; scoring on semantic similarity only")
        skill_score = 0.0
        overall_score = semantic_score

    return AnalysisResult(
        overall_score=overall_score,
        semantic_score=semantic_score,
        skill_score=skill_score,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        recommendations=_recommendations(missing_skills, job_skills, semantic_score),
    )
