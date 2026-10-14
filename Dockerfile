# Backend de brrrr. (FastAPI) para el servidor propio (skyze-server).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

# Solo el código del servidor (sin tests, frontend, APK ni .env: ver .dockerignore).
COPY api ./api
COPY core ./core
COPY db ./db
COPY schemas ./schemas

# Sin privilegios: un usuario sin shell ni home.
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

# Un solo worker: el servidor tiene 1 GB de RAM compartido con otros servicios.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-server-header"]
