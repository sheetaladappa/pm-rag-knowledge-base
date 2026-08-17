FROM python:3.11-slim

WORKDIR /app

# build-essential covers any package here that needs to compile from source
# on a platform without a prebuilt wheel. Nothing else is needed now that
# unstructured (and its libmagic/poppler requirements) has been removed.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /app/data/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
