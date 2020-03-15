FROM python:latest

ENV PORT 3004

WORKDIR /app

COPY ./requirements.txt .

RUN pip install -r requirements.txt

COPY . .

CMD ["python", "app.py"]
