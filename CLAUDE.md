# Calculadora BRRRR

Aplicación web que evalúa la rentabilidad de deals inmobiliarios con el método
BRRRR (Buy, Rehab, Rent, Refinance, Repeat). El usuario ingresa los datos de una
propiedad y de un prestamista privado, y la app calcula cuánto capital queda
atrapado después de refinanciar con el banco.

## Stack

- Backend: Python 3.11+, FastAPI, SQLAlchemy, Alembic
- Base de datos: PostgreSQL
- Frontend: React + Vite
- Tests: pytest

## Arquitectura

```
core/        Cálculo puro. No importa nada de db/ ni api/.
db/          Modelos SQLAlchemy y migraciones.
api/         Endpoints FastAPI.
schemas/     Pydantic de entrada y salida.
tests/       pytest
frontend/    React
```

## Reglas que no se rompen

1. Todo el dinero es `Decimal`, nunca `float`. En la base de datos, `NUMERIC`,
   nunca `FLOAT`. En el JSON, string, nunca número.
2. `core/` es puro. Funciones sin efectos secundarios, sin sesiones de base de
   datos, sin imports de FastAPI. Debe poder probarse solo.
3. `core/calculator.py` no se modifica sin tests que lo cubran. Es la pieza que
   decide si un deal sirve o no; un error ahí cuesta dinero real.
4. El frontend no hace aritmética. Solo muestra lo que devuelve la API.
5. Código y comentarios en español. Nombres de variables y funciones en inglés
   cuando son términos del dominio (payoff, cash_out, arv).

## Glosario del dominio

- **ARV**: valor de la propiedad después de reparada, según comparables.
- **LTC**: porcentaje que el prestamista privado financia sobre el costo total
  (compra + rehab).
- **LTV**: porcentaje que el banco presta sobre el ARV al refinanciar.
  Típicamente 75%.
- **Seasoning**: meses que hay que esperar antes de poder refinanciar.
- **Draws**: desembolsos parciales del rehab. Los intereses corren solo sobre el
  saldo desembolsado, no sobre el préstamo completo.
- **Payoff**: lo que se le entrega al prestamista privado el día del refi.
- **Cash out**: dinero que devuelve el banco después de pagar el payoff y los
  costos de cierre.
- **Dinero atrapado**: total invertido menos cash out. Es la métrica que decide
  si el deal sirve. Mientras más cerca de cero, mejor.
- **Scope of work**: lista de partidas de la reparación. El prestamista la exige
  completa.

## Comandos

```bash
pytest                          # tests
pytest tests/test_calculator.py # tests del cálculo
uvicorn api.main:app --reload   # levantar el backend
alembic upgrade head            # aplicar migraciones
docker compose up -d            # levantar Postgres
```

## Cómo trabajo

- Una tarea a la vez. Si una tarea abarca varias capas, propón el plan antes de
  escribir código.
- Después de tocar `core/`, corre los tests antes de darla por terminada.
- Si un cálculo financiero te parece ambiguo, pregunta en vez de asumir.
