"""Entradas y resultados de la búsqueda de básicos para rehab (Google Shopping)."""

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
# Término de búsqueda en inglés (mejores resultados en Google Shopping US).
CATEGORY_QUERY_EN = {
    "mirrors": "mirror",
    "lighting": "light fixture",
    "faucets": "faucet",
    "handles": "cabinet handles",
    "bathroom": "bathroom accessories",
    "other": "home improvement basics",
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


class ProductItem(BaseModel):
    """Un producto de Google Shopping: foto, precio y tienda."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    store: str = Field(min_length=1, max_length=100)
    url: str = Field(min_length=1, max_length=2048)
    image: str | None = Field(default=None, max_length=2048)
    # Precio como string decimal "xx.xx", o null si la tienda no lo publica.
    price: str | None = Field(default=None, pattern=r"^\d{1,9}\.\d{2}$")
    currency: str = Field(min_length=3, max_length=3)
    rating: float | None = Field(default=None, ge=0, le=5)
    delivery: str = Field(default="", max_length=160)


class ProductSearchResult(BaseModel):
    products: list[ProductItem]
    searched_at: str
    country: Country
    currency: str
    query: str
    message: str
