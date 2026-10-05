"""Genera el analisis del deal en lenguaje natural con OpenAI (ChatGPT).

NO es puro: llama a la red. Por eso vive en api/, no en core/. La IA solo
EXPLICA los numeros que le manda el frontend (ya calculados); no recalcula ni
inventa montos. Asi el endpoint no depende del calculo del backend.
"""

from __future__ import annotations

import html
import ipaddress
import json
import os
import re
import socket
from decimal import Decimal, InvalidOperation
from urllib.parse import urljoin, urlparse

import httpx
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


# --- Autocompletar el deal desde una foto (vision) ---

EXTRACT_SYSTEM = (
    "Sos un asistente que lee la foto de un aviso o publicacion inmobiliaria (o "
    "una captura) y extrae los datos de la propiedad. Devolve UNICAMENTE un JSON "
    "con estas claves, todas OPCIONALES (incluila solo si el dato aparece "
    "explicito en la imagen): "
    "name (direccion o titulo del aviso), purchase_price (precio de venta), "
    "arv (valor despues de reparado, si figura), rehab_budget (costo de "
    "reparacion, si figura). "
    "Los montos van como numero entero, sin simbolo ni separadores (ej: 150000). "
    "NO inventes ni estimes valores: si un dato no esta en la imagen, omiti esa "
    "clave. Responde solo el JSON, sin texto extra."
)

# Solo estas claves se aceptan de la extraccion (datos de un aviso).
_EXTRAIBLES = {"name", "purchase_price", "arv", "rehab_budget"}


def extraer_deal(image_data_url: str) -> dict[str, str]:
    """Lee una imagen (data URL base64) y devuelve los campos del deal que

    encuentre. Solo extrae lo explicito; limpia los montos a digitos.
    """
    client = openai.OpenAI()
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=300,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EXTRACT_SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extrae los datos de esta propiedad."},
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        ],
    )
    data = json.loads(response.choices[0].message.content or "{}")
    return _campos_extraidos(data)


def _campos_extraidos(data: dict) -> dict[str, str]:
    """Deja solo las claves extraibles; los montos a digitos, el nombre limpio."""
    out: dict[str, str] = {}
    for clave, valor in data.items():
        if clave not in _EXTRAIBLES or valor in (None, ""):
            continue
        if clave == "name":
            out[clave] = str(valor).strip()[:120]
        else:
            digitos = "".join(ch for ch in str(valor) if ch.isdigit())
            if digitos:
                out[clave] = digitos
    return out


# --- Autocompletar el deal desde el link de un aviso ---

EXTRACT_SYSTEM_TEXT = (
    "Sos un asistente que lee el texto de una pagina de un aviso o publicacion "
    "inmobiliaria y extrae los datos de la propiedad. Devolve UNICAMENTE un JSON "
    "con estas claves, todas OPCIONALES (incluila solo si el dato aparece): "
    "name (direccion o titulo del aviso), purchase_price (precio de venta), "
    "arv (valor despues de reparado, si figura), rehab_budget (costo de "
    "reparacion, si figura). "
    "Los montos van como numero entero, sin simbolo ni separadores (ej: 150000). "
    "NO inventes ni estimes valores: si un dato no esta, omiti esa clave. "
    "Responde solo el JSON."
)

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Topes de la descarga del aviso: tamano maximo y redirecciones permitidas.
MAX_PAGE_BYTES = 2_000_000
MAX_REDIRECTS = 3

# Servicio de scraping (IPs residenciales + anti-bot) para portales que bloquean
# las IPs de datacenter como Zillow / Realtor / Redfin. Opcional: si no hay
# SCRAPER_API_KEY en el entorno, solo se usa el fetch directo.
SCRAPER_ENDPOINT = "https://api.scraperapi.com/"


def _es_host_publico(host: str) -> bool:
    """True solo si TODAS las IPs del host son publicas (anti-SSRF).

    Resuelve el nombre y rechaza loopback, redes privadas, link-local (incluye
    la IP de metadata del cloud 169.254.169.254), reservadas y multicast. Asi el
    backend no puede ser usado para alcanzar servicios internos.
    """
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if (
            not ip.is_global
            or ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return False
    return True


def _descargar_seguro(url: str) -> str:
    """Descarga la pagina del aviso con tope de tamano y proteccion anti-SSRF.

    Primero intenta el fetch directo (gratis). Si el sitio responde con un error
    HTTP (p. ej. Zillow devuelve 403 a las IPs de datacenter) y hay un servicio
    de scraping configurado (SCRAPER_API_KEY), reintenta a traves de el con una
    IP residencial. Un ValueError (destino interno / URL invalida) NO se
    reintenta: es un bloqueo de seguridad, no una falla del sitio.
    """
    try:
        return _descargar_directo(url)
    except httpx.HTTPError:
        clave = os.environ.get("SCRAPER_API_KEY")
        if not clave:
            raise
        return _descargar_via_scraper(url, clave)


def _descargar_via_scraper(url: str, clave: str) -> str:
    """Trae la pagina a traves del servicio de scraping (IP residencial).

    El servicio hace el pedido desde su red, no desde la nuestra, asi que no
    puede alcanzar servicios internos; aun asi validamos que el host sea publico
    antes de gastar un credito. Lanza httpx.HTTPError si el servicio falla.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("URL no permitida.")
    if not _es_host_publico(parsed.hostname):
        raise ValueError("El link apunta a un destino interno no permitido.")

    # Parametros configurables por entorno para no atarse al plan:
    #  - SCRAPER_RENDER (default "true"): ejecuta el JS de la pagina.
    #  - SCRAPER_PREMIUM ("", "premium" o "ultra"): los pools premium/
    #    residenciales (necesarios para Zillow/Realtor) solo existen en los
    #    planes pagos de ScraperAPI. Por defecto NO se piden, para que el plan
    #    free no rechace el pedido. Al subir de plan, se activa con la variable
    #    SCRAPER_PREMIUM=ultra en Render, sin tocar el codigo.
    params = {"api_key": clave, "url": url, "country_code": "us"}
    if os.environ.get("SCRAPER_RENDER", "true").strip().lower() != "false":
        params["render"] = "true"
    nivel = os.environ.get("SCRAPER_PREMIUM", "").strip().lower()
    if nivel == "premium":
        params["premium"] = "true"
    elif nivel in ("ultra", "ultra_premium"):
        params["ultra_premium"] = "true"

    with httpx.Client(timeout=75.0) as cliente:
        resp = cliente.get(SCRAPER_ENDPOINT, params=params)
        resp.raise_for_status()
        return _condensar_pagina(resp.text[:MAX_PAGE_BYTES])


def _descargar_directo(url: str) -> str:
    """Descarga la pagina validando cada salto contra SSRF y con tope de tamano.

    No deja que httpx siga redirecciones solo: las sigue a mano (hasta
    MAX_REDIRECTS) validando el host de cada destino. Corta la lectura al llegar
    a MAX_PAGE_BYTES. Lanza ValueError si la URL apunta a un destino no
    permitido; httpx.HTTPError ante fallos de red o respuestas 4xx/5xx.
    """
    actual = url
    with httpx.Client(
        follow_redirects=False,
        timeout=15.0,
        headers={"User-Agent": _UA, "Accept-Language": "es,en;q=0.8"},
    ) as cliente:
        for _ in range(MAX_REDIRECTS + 1):
            parsed = urlparse(actual)
            if parsed.scheme not in ("http", "https") or not parsed.hostname:
                raise ValueError("URL no permitida.")
            if not _es_host_publico(parsed.hostname):
                raise ValueError("El link apunta a un destino interno no permitido.")

            with cliente.stream("GET", actual) as resp:
                if resp.is_redirect:
                    destino = resp.headers.get("location")
                    if not destino:
                        raise ValueError("Redireccion invalida.")
                    actual = urljoin(actual, destino)
                    continue
                resp.raise_for_status()
                trozos: list[bytes] = []
                total = 0
                for trozo in resp.iter_bytes():
                    total += len(trozo)
                    trozos.append(trozo)
                    if total >= MAX_PAGE_BYTES:
                        break
                crudo = b"".join(trozos)[:MAX_PAGE_BYTES]
                texto = crudo.decode(resp.encoding or "utf-8", errors="ignore")
                return _condensar_pagina(texto)
    raise ValueError("Demasiadas redirecciones.")


def _limpiar_texto(s: str) -> str:
    return html.unescape(re.sub(r"\s+", " ", s)).strip()


def _condensar_pagina(html_text: str) -> str:
    """Arma un texto corto con lo util: titulo, meta tags, JSON-LD y texto."""
    partes: list[str] = []

    m = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.I | re.S)
    if m:
        partes.append("Titulo: " + _limpiar_texto(m.group(1)))

    for mm in re.finditer(r"<meta[^>]+>", html_text, re.I):
        tag = mm.group(0)
        nombre = re.search(r'(?:name|property)\s*=\s*["\']([^"\']+)["\']', tag, re.I)
        contenido = re.search(r'content\s*=\s*["\']([^"\']*)["\']', tag, re.I)
        if nombre and contenido:
            clave = nombre.group(1).lower()
            if any(k in clave for k in ("title", "description", "price", "og:", "product")):
                partes.append(f"{nombre.group(1)}: {_limpiar_texto(contenido.group(1))}")

    for jm in re.finditer(
        r"<script[^>]+application/ld\+json[^>]*>(.*?)</script>", html_text, re.I | re.S
    ):
        partes.append("JSON-LD: " + jm.group(1).strip()[:2000])

    cuerpo = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html_text, flags=re.I | re.S)
    cuerpo = re.sub(r"<[^>]+>", " ", cuerpo)
    partes.append("Texto: " + _limpiar_texto(cuerpo)[:4000])

    return "\n".join(partes)[:12000]


# --- Zillow: via Zillapi (datos estructurados por URL, sin scraping ni IA) ---
#
# Zillow bloquea las IPs de servidor, asi que el scraping directo no sirve.
# Zillapi (zillapi.com) devuelve el inmueble ya estructurado a partir de la URL.
# Si hay ZILLAPI_KEY y el link es de Zillow, se usa esta via; si no, la generica.

ZILLAPI_URL = "https://zillapi.com/v1/properties/by-url"


def _es_zillow(url: str) -> bool:
    """True si la URL es de zillow.com (o un subdominio)."""
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        return False
    return host == "zillow.com" or host.endswith(".zillow.com")


def _direccion_zillapi(address) -> str:
    """Arma el nombre del deal desde el objeto address de Zillapi."""
    if isinstance(address, str):
        return address.strip()
    if isinstance(address, dict):
        partes = [address.get(k) for k in ("streetAddress", "city", "state")]
        partes = [str(p).strip() for p in partes if p]
        if partes:
            return ", ".join(partes)
    return ""


def extraer_deal_zillapi(url: str) -> dict[str, str]:
    """Trae el inmueble de Zillow via Zillapi y lo mapea a los campos del deal.

    price -> precio de compra, zestimate -> ARV (estimado, editable), address ->
    nombre. El rehab no viene (lo completa el usuario). Lanza httpx.HTTPError si
    Zillapi falla (key invalida, sin creditos, URL no resuelta).
    """
    clave = os.environ.get("ZILLAPI_KEY")
    if not clave:
        raise ValueError("Zillapi no configurado.")
    with httpx.Client(timeout=30.0) as cliente:
        resp = cliente.get(
            ZILLAPI_URL,
            params={"url": url},
            headers={"Authorization": f"Bearer {clave}"},
        )
        resp.raise_for_status()
        data = (resp.json() or {}).get("data") or {}

    crudo: dict = {}
    nombre = _direccion_zillapi(data.get("address"))
    if nombre:
        crudo["name"] = nombre
    precio = data.get("price")
    if isinstance(precio, (int, float)) and precio > 0:
        crudo["purchase_price"] = int(precio)
    zestimate = data.get("zestimate")
    if isinstance(zestimate, (int, float)) and zestimate > 0:
        crudo["arv"] = int(zestimate)
    return _campos_extraidos(crudo)


def extraer_deal_url(url: str) -> dict[str, str]:
    """Descarga la pagina del aviso y extrae los campos del deal.

    Si el link es de Zillow y hay ZILLAPI_KEY, usa Zillapi (datos estructurados).
    Si no, baja la pagina (fetch directo o scraper) y la lee con IA.

    Puede lanzar httpx.HTTPError si no se puede descargar; openai.* si falla la
    IA. El endpoint las traduce a respuestas amables.
    """
    if _es_zillow(url) and os.environ.get("ZILLAPI_KEY"):
        return extraer_deal_zillapi(url)

    contenido = _descargar_seguro(url)

    client = openai.OpenAI()
    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=300,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": EXTRACT_SYSTEM_TEXT},
            {"role": "user", "content": "Texto de la pagina del aviso:\n\n" + contenido},
        ],
    )
    data = json.loads(response.choices[0].message.content or "{}")
    return _campos_extraidos(data)
