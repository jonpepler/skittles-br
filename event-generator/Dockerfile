FROM tiangolo/uvicorn-gunicorn-fastapi

ENV PORT 3004

WORKDIR /app

COPY . .

HEALTHCHECK --interval=5m --retries=5 CMD curl --fail http://localhost:${PORT}/ || exit 1
