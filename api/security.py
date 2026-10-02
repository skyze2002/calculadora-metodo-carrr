"""Llave de app: cierra los endpoints de IA a quien no sea nuestra app.

La APK / el frontend mandan el header `X-App-Key`. El backend lo compara contra
la variable de entorno APP_KEY. Si APP_KEY no esta seteada (desarrollo local),
no se exige nada, asi el dev sigue andando sin configurar la llave.

NO es un secreto de alto valor: una llave embebida en un cliente se puede
extraer. Su objetivo es frenar bots, escaneos y webs ajenas que descubran la URL
y quieran gastar nuestros creditos de OpenAI, no a un atacante decidido.
"""

from __future__ import annotations

import os
import secrets

from fastapi import Header, HTTPException, status


def requiere_app_key(x_app_key: str | None = Header(default=None)) -> None:
    """Dependencia de FastAPI: 401 si falta o no coincide la llave de app.

    Compara en tiempo constante para no filtrar la llave por timing. Si APP_KEY
    no esta configurada en el entorno, no exige nada (modo desarrollo).
    """
    esperada = os.environ.get("APP_KEY")
    if not esperada:
        return
    if not x_app_key or not secrets.compare_digest(x_app_key, esperada):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autorizado.",
        )
