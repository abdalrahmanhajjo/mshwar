# syntax=docker/dockerfile:1
# Production image for the FastAPI service. Local development overrides the
# command with --reload and mounts the source (see docker-compose.yml).
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

FROM base AS runtime
# Wheels exist for every runtime dependency, so no compiler is needed.
COPY requirements.txt ./
RUN pip install -r requirements.txt
RUN useradd --create-home --uid 10001 mshwar
COPY app ./app
COPY scripts ./scripts
USER mshwar
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
