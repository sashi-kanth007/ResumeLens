from datetime import datetime, timezone

from pydantic import BaseModel, field_validator


class AnalysisResult(BaseModel):
    overall_score: float
    semantic_score: float
    skill_score: float
    matched_skills: list[str]
    missing_skills: list[str]
    recommendations: list[str]


class _Timestamped(BaseModel):
    id: int
    created_at: datetime
    resume_filename: str

    @field_validator("created_at")
    @classmethod
    def assume_utc(cls, value: datetime) -> datetime:
        # SQLite drops timezone info; everything is stored in UTC.
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


class AnalysisResponse(_Timestamped):
    result: AnalysisResult


class AnalysisHistoryItem(_Timestamped):
    overall_score: float
