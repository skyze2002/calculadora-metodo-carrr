#!/usr/bin/env bash
# Publica la versión commiteada (HEAD) del backend en skyze-server.
# Uso: deploy/skyze/deploy.sh   (desde la raíz del repo)
set -euo pipefail
HOST="${HOST:-dev@rentaven.app}"
DIR="brrrr-api"
cd "$(dirname "$0")/../.."

[[ -z "$(git status --porcelain -- api core db schemas requirements.txt Dockerfile)" ]] \
  || { echo "Hay cambios sin commitear en el backend: commiteá antes de desplegar."; exit 1; }

# Solo lo que está en git (nunca .env, .venv ni archivos locales).
git archive --format=tar HEAD Dockerfile .dockerignore requirements.txt api core db schemas \
  | ssh "$HOST" "rm -rf ~/$DIR/src && mkdir -p ~/$DIR/src && tar -x -C ~/$DIR/src"
scp -q deploy/skyze/docker-compose.yml "$HOST:~/$DIR/docker-compose.yml"

ssh "$HOST" "cd ~/$DIR && test -f .env || { echo 'Falta ~/$DIR/.env (ver env.example)'; exit 1; } \
  && chmod 600 .env && docker compose build --pull -q && docker compose up -d \
  && sleep 8 && docker compose ps"
