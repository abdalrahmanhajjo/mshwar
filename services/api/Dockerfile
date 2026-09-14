FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY alembic.ini ./
RUN useradd --create-home --uid 10001 mshwar && mkdir -p /tmp/mshwar-private && chown mshwar /tmp/mshwar-private
USER mshwar
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
