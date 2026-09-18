# syntax=docker/dockerfile:1
# Production image for the FastAPI service. Local development overrides the
# command with --reload and mounts the source (see docker-compose.yml).
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
# The python:3.11-slim tag lags Debian's security archive, so the published
# fixes for gzip, libpcre2, libsqlite3 and perl-base are not in the base layer
# yet. Pull them at build time instead of pinning a newer Python minor.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS runtime
# Wheels exist for every runtime dependency, so no compiler is needed.
# The base image ships wheel 0.45.1 and a setuptools that vendors
# jaraco.context 5.3.0, both with known HIGH advisories. Upgrade them for the
# install, then drop wheel, which nothing needs once the app is built.
COPY requirements.txt ./
RUN pip install --upgrade pip setuptools wheel \
    && pip install -r requirements.txt \
    && pip uninstall -y wheel
RUN useradd --create-home --uid 10001 mshwar
COPY app ./app
COPY scripts ./scripts
USER mshwar
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
