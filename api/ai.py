"""Genera el analisis del deal en lenguaje natural con OpenAI (ChatGPT).

NO es puro: llama a la red. Por eso vive en api/, no en core/. La IA solo
EXPLICA los numeros que le manda el frontend (ya calculados); no recalcula ni
inventa montos. Asi el endpoint no depende del calculo del backend.
"""

from __future__ import annotations

import os
from decimal import Decimal, InvalidOperation

import openai

# Modelo de OpenAI. gpt-4o-mini es barato y alcanza para explicar un resultado.
# Se puede cambiar con la variable de entorno OPENAI_MODEL.
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

SYSTEM = (
    "Sos un asesor inmobiliario que le explica un deal BRRRR a un inversor, con "
    "tono cercano, claro y profesional (hablas de vos, espanol rioplatense). "
    "Te paso los numeros YA CALCULADOS del deal. Escribi UN SOLO parrafo de 2 a 4 "
    "frases, sin vinetas ni titulos.\n"
    "La metrica clave es el DINERO ATRAPADO (capital que queda inmovilizado en la "
    "propiedad): si es cero o negativo el deal es excelente, porque recuperas todo "
    "lo que pusiste; y si es negativo, ademas te sobra ese monto libre para el "
    "proximo deal. Un valor positivo chico esta al limite; uno positivo grande no "
    "conviene.\n"
    "SIEMPRE cerra con una recomendacion o tip accionable. "
    "Si el deal es BUENO (dinero atrapado cero o negativo): explica por que "
    "conviene y da un tip para aprovecharlo. "
    "Si el deal es MALO (dinero atrapado positivo): explica que queda demasiado "
    "capital atrapado y deci CONCRETAMENTE a cuanto habria que negociar el precio "
    "de compra y/o cuanto deberia ser el rehab para que el deal cierre, usando "
    "EXCLUSIVAMENTE los montos sugeridos que te paso (no inventes otros numeros).\n"
    "Usa los montos tal como te los doy (ya vienen con formato $) de forma "
    "natural; NO leas numeros crudos ni con decimales, y NO inventes ni recalcules "
    "nada: usa solo lo que te paso. "
    "IMPORTANTE: escribi SIEMPRE los montos con punto como separador de miles y el "
    "signo $ adelante, tal cual te los paso (por ejemplo $135.000 o -$5.000). "
    "Nunca uses la coma como separador de miles."
)

# Claves conocidas del resultado y como nombrarlas en el prompt.
ETIQUETAS = {
    "trapped_cash": "Dinero atrapado",
    "purchase_price": "Precio de compra actual",
    "rehab_budget": "Rehab actual",
    "total_cost": "Costo total (compra + rehab)",
    "total_invested": "Total invertido",
    "cash_out": "Dinero devuelto por el banco (cash out)",
    "lender_closing": "Se lleva el prestamista al cierre",
    "private_loan_amount": "Total del prestamo",
    "down_payment": "Aporte inicial",
    "refinance_loan_amount": "Prestamo del refi",
}


def credenciales_configuradas() -> bool:
    """True si hay una API key para llamar a OpenAI (env)."""
    return bool(os.environ.get("OPENAI_API_KEY"))


def _valor(valor) -> Decimal | None:
    """Parsea un monto a Decimal, o None si no se puede."""
    try:
        return Decimal(str(valor))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _money(valor: str) -> str:
    """Formatea un monto para que la IA lo lea lindo: '-5000.00' -> '-$5.000'.

    Redondea a entero (los centavos no aportan al relato) y usa punto como
    separador de miles. Si no parsea, devuelve el valor tal cual.
    """
    d = _valor(valor)
    if d is None:
        return str(valor)
    signo = "-" if d < 0 else ""
    entero = int(abs(d).to_integral_value())
    return f"{signo}${entero:,}".replace(",", ".")


def _es_malo(result: dict[str, str]) -> bool:
    """True si el dinero atrapado es positivo (el deal no cierra)."""
    d = _valor(result.get("trapped_cash"))
    return d is not None and d > 0


def generar_analisis(nombre: str, result: dict[str, str]) -> str:
    """Llama a OpenAI con los numeros del deal y devuelve el analisis en texto.

    Usa las credenciales del entorno (OPENAI_API_KEY). Puede lanzar
    openai.AuthenticationError si la key es invalida, u openai.APIError ante
    otros fallos: el endpoint las traduce a una respuesta amable.
    """
    lineas = [f"Deal: {nombre or 'sin nombre'}"]
    for clave, etiqueta in ETIQUETAS.items():
        if clave in result and result[clave] is not None:
            lineas.append(f"{etiqueta}: {_money(result[clave])}")

    # Si el deal es malo (dinero atrapado positivo), agrega los montos objetivo
    # ya calculados para que la IA recomiende sin inventar numeros.
    if _es_malo(result):
        tp = _valor(result.get("target_purchase"))
        tr = _valor(result.get("target_rehab"))
        lineas.append("")
        lineas.append(
            "El deal NO cierra. Montos sugeridos para que el dinero atrapado "
            "llegue a cero (usa estos, no inventes):"
        )
        if tp is not None and tp > 0:
            lineas.append(
                f"- Precio de compra maximo (manteniendo el rehab actual): {_money(tp)}"
            )
        if tr is not None and tr > 0:
            lineas.append(
                f"- Rehab maximo (manteniendo la compra actual): {_money(tr)}"
            )
        if (tp is None or tp <= 0) and (tr is None or tr <= 0):
            lineas.append(
                "- Ni bajando la compra ni el rehab alcanza: el ARV o el LTV son "
                "muy bajos para este proyecto."
            )
    datos = "\n".join(lineas)

    client = openai.OpenAI()
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=400,
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": datos},
        ],
    )
    return (response.choices[0].message.content or "").strip()
