FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System deps for building wheels if needed
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first to maximize cache usage
COPY requirements.txt .
# Upgrade pip for better network resilience and install with sensible retries/timeouts
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --retries 5 --timeout 120 -r requirements.txt

# Copy backend source
COPY . .

EXPOSE 8000

# Start FastAPI with Uvicorn (production mode, no reload)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
