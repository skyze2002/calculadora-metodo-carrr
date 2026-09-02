"""Fixtures compartidos de los tests.

Para no depender de Postgres, los tests de la API usan SQLite en memoria y
sobreescriben la dependencia get_session. StaticPool hace que todas las sesiones
compartan la misma conexion (misma base en memoria).
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from api.main import app
from db.base import Base
from db.session import get_session

# Importa los modelos para registrarlos en Base.metadata.
import db.models  # noqa: F401


@pytest.fixture
def client() -> Iterator[TestClient]:
    """Cliente de la API apuntando a una base SQLite en memoria y limpia."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override() -> Iterator[Session]:
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()
