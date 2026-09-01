"""Configuracion de la conexion a la base de datos."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Lee la configuracion desde variables de entorno / archivo .env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://brrrr:brrrr@localhost:5432/brrrr"


settings = Settings()
