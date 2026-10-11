"""Entradas y resultados de comparables (comps) de una propiedad."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Tipos de vivienda que acepta el filtro de Zillow (search).
HOME_TYPES = ("house", "condo", "townhouse", "multi_family", "manufactured", "lot", "apartment")


class CompsRequest(BaseModel):
    """Pedido de comps: la dirección del deal + filtros opcionales editables.

    Si los filtros se omiten, se derivan del inmueble (mismas condiciones).
    """

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    address: str = Field(min_length=3, max_length=300)
    status: Literal["sold", "for_sale", "both"] = "both"
    radius_mi: float = Field(default=3.0, ge=0.5, le=25)
    beds_min: int | None = Field(default=None, ge=0, le=20)
    beds_max: int | None = Field(default=None, ge=0, le=20)
    baths_min: float | None = Field(default=None, ge=0, le=20)
    sqft_min: int | None = Field(default=None, ge=0, le=100000)
    sqft_max: int | None = Field(default=None, ge=0, le=100000)
    home_types: list[str] | None = Field(default=None, max_length=7)


class Subject(BaseModel):
    """La propiedad de referencia (el deal)."""

    address: str = ""
    url: str = ""
    image: str | None = None
    beds: float | None = None
    baths: float | None = None
    sqft: int | None = None
    home_type: str | None = None
    zestimate: str | None = None
    price: str | None = None
    lat: float | None = None
    lng: float | None = None


class CompItem(BaseModel):
    """Una propiedad comparable."""

    zpid: str
    address: str = ""
    url: str
    image: str | None = None
    price: str | None = None
    status: str = "other"  # "sold" | "for_sale" | "other"
    beds: float | None = None
    baths: float | None = None
    sqft: int | None = None
    price_per_sqft: str | None = None
    date_sold: str = ""
    distance_mi: float | None = None


class CompsResult(BaseModel):
    subject: Subject
    comps: list[CompItem]
    relaxed: bool = False
    arv_suggestion: str | None = None
    message: str = ""
    counts: dict[str, int] = Field(default_factory=dict)
