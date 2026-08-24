FROM python:3.12.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --gid 10001 openvoiss \
    && useradd --uid 10001 --gid openvoiss --create-home openvoiss

WORKDIR /app/backend

COPY requirements.txt ./requirements.txt
COPY pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir -r requirements.txt

COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
COPY app ./app
COPY tests ./tests

RUN mkdir -p /app/backend/storage \
    && chown -R openvoiss:openvoiss /app

USER openvoiss

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
