"""Entradas y resultados de la búsqueda de básicos para rehab."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Category = Literal["mirrors", "lighting", "faucets", "handles", "bathroom", "other"]
Country = Literal["US", "PE", "MX", "CO", "ES", "AR", "CL"]

MARKETS = {
    "US": ("Estados Unidos", "USD"),
    "PE": ("Perú", "PEN"),
    "MX": ("México", "MXN"),
    "CO": ("Colombia", "COP"),
    "ES": ("España", "EUR"),
    "AR": ("Argentina", "ARS"),
    "CL": ("Chile", "CLP"),
}
CATEGORIES = {
    "mirrors": "Espejos",
    "lighting": "Luces y lámparas",
    "faucets": "Grifos",
    "handles": "Tiradores y manijas",
    "bathroom": "Accesorios de baño",
    "other": "Otros básicos para rehab",
}


class ProductSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    category: Category
    country: Country
    city: str = Field(default="", max_length=80)
    region: str = Field(default="", max_length=80)
    budget: str | None = Field(default=None, pattern=r"^\d{1,9}(?:\.\d{1,2})?$")
    details: str = Field(default="", max_length=400)

    @field_validator("budget")
    @classmethod
    def presupuesto_positivo(cls, value: str | None) -> str | None:
        if value is not None and not any(digit in "123456789" for digit in value):
            raise ValueError("El presupuesto debe ser mayor que cero.")
        return value


class ProductCandidate(BaseModel):
    """La IA debe devolver todos los campos; precio desconocido es null."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=180)
    store: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=2048)
    price: str | None = Field(pattern=r"^\d{1,9}(?:\.\d{1,2})?$")
    currency: str = Field(min_length=3, max_length=3)
    price_note: str = Field(max_length=300)
    shipping_note: str = Field(max_length=300)
    reason: str = Field(max_length=400)


class ProductResearch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    products: list[ProductCandidate] = Field(max_length=6)


class ProductSource(BaseModel):
    title: str
    url: str


class ProductSearchResult(BaseModel):
    products: list[ProductCandidate]
    sources: list[ProductSource]
    searched_at: str
    country: Country
    currency: str
    message: str
