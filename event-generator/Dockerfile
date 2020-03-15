FROM tiangolo/uvicorn-gunicorn-fastapi

ENV PORT 3004

WORKDIR /app

COPY . .

HEALTHCHECK --interval=2s --retries=15 CMD curl --fail http://localhost:${PORT}/ || exit 1
