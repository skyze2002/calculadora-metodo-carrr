"""Genera el analisis del deal en lenguaje natural con Claude.

NO es puro: llama a la red. Por eso vive en api/, no en core/. La IA solo
EXPLICA los numeros que le manda el frontend (ya calculados); no recalcula ni
inventa montos. Asi el endpoint no depende del calculo del backend.
"""

from __future__ import annotations

import os

import anthropic

# Haiku 4.5: rapido y barato, alcanza para explicar un resultado.
MODEL = "claude-haiku-4-5"

SYSTEM = (
    "Sos un analista de inversiones inmobiliarias que evalua deals con el metodo "
    "BRRRR. Hablas en espanol rioplatense (de vos), claro y directo. "
    "Te paso los numeros YA CALCULADOS de un deal. Explicale al inversor, en 2 a "
    "4 frases, si el deal sirve y por que, y dale 1 o 2 sugerencias concretas y "
    "accionables. La metrica clave es el dinero atrapado: mientras mas cerca de "
    "cero (o negativo), mejor. "
    "NO inventes ni recalcules numeros: usa solo los que te doy. No uses vinetas "
    "ni titulos: un solo parrafo corto y natural."
)

# Claves conocidas del resultado y como nombrarlas en el prompt.
ETIQUETAS = {
    "trapped_cash": "Dinero atrapado",
    "total_invested": "Total invertido",
    "cash_out": "Dinero devuelto por el banco (cash out)",
    "lender_closing": "Se lleva el prestamista al cierre",
    "private_loan_amount": "Total del prestamo",
    "down_payment": "Aporte inicial",
    "refinance_loan_amount": "Prestamo del refi",
    "total_cost": "Costo total (compra + rehab)",
}


def credenciales_configuradas() -> bool:
    """True si hay una API key para llamar a Claude (env)."""
    return bool(
        os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")
    )


def generar_analisis(nombre: str, result: dict[str, str]) -> str:
    """Llama a Claude con los numeros del deal y devuelve el analisis en texto.

    Usa las credenciales del entorno (ANTHROPIC_API_KEY). Puede lanzar
    anthropic.AuthenticationError si no hay key, o anthropic.APIError ante otros
    fallos: el endpoint las traduce a una respuesta amable.
    """
    lineas = [f"Deal: {nombre or 'sin nombre'}"]
    for clave, etiqueta in ETIQUETAS.items():
        if clave in result and result[clave] is not None:
            lineas.append(f"{etiqueta}: {result[clave]}")
    datos = "\n".join(lineas)

    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=400,
        system=SYSTEM,
        messages=[{"role": "user", "content": datos}],
    )
    return "".join(b.text for b in response.content if b.type == "text").strip()
