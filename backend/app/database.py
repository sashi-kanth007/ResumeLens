from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings


def _engine_options(url: str) -> dict:
    if not url.startswith("sqlite"):
        return {}
    # FastAPI may use a connection from several threads; SQLite forbids that by default.
    options: dict = {"connect_args": {"check_same_thread": False}}
    if url in ("sqlite://", "sqlite:///:memory:"):
        # Share one in-memory database across connections (used by tests).
        options["poolclass"] = StaticPool
    return options


engine = create_engine(settings.database_url, **_engine_options(settings.database_url))


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
