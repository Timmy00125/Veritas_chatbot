FROM python:3.12-slim

WORKDIR /app

# Make pip more resilient to transient network slowness during image builds.
ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --progress-bar off -r requirements.txt

COPY . .

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
